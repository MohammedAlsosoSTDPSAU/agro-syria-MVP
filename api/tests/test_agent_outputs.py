"""Regression + output-contract suite for the async parallel agent pipeline.

Coverage:
  1. Liaison intent detection & slot extraction (Syrian agricultural dialect).
  2. Deterministic orchestrator router (parallel fan-out, short-circuits).
  3. Calculator mathematical accuracy (irrigation formulas, types, ranges).
  4. End-to-end pipeline output integrity (non-empty localized reply).

Every assertion validates a concrete agent output contract.
"""

from __future__ import annotations

import pytest
from langchain_core.messages import HumanMessage
from langgraph.graph import END

import app.core.graph as g
from app.core.graph import (
    _compute_tips,
    _detect_intent,
    _extract_slots,
    _is_greeting,
    _run_tool,
    liaison_node,
)
from app.orchestration import get_orchestrator
from app.orchestration.agent_orchestrator import (
    CALENDAR,
    IRRIGATION,
    LIAISON,
    MARKET,
    RESEARCH,
    SOIL,
    SYNTHESIZER,
    VISION,
)
from app.orchestration.schemas import (
    CalculatorOutput,
    LiaisonOutput,
    SynthesizerOutput,
    coerce,
)
from app.routes.chat import _resolve_output
from app.tools.irrigation_tool import calculate_irrigation


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _seed(message: str, image_base64: str | None = None) -> dict:
    """Build a fresh initial GraphState as the chat route does."""
    return {
        "messages": [HumanMessage(content=message)],
        "sender": "user",
        "agricultural_context": {"image_base64": image_base64},
    }


def _state(sender: str, **context) -> dict:
    return {"messages": [], "sender": sender, "agricultural_context": context}


# ─────────────────────────────────────────────────────────────────────────────
# 1. Liaison Agent — intent detection & slot extraction
# ─────────────────────────────────────────────────────────────────────────────
class TestLiaisonIntent:
    @pytest.mark.parametrize(
        "text",
        ["كيف أروي القمح", "كيف اروي القمح", "احسب الري للقمح", "كم مياه بدو القمح"],
    )
    def test_irrigation_intent_detected(self, text: str) -> None:
        assert _detect_intent(text) == "irrigation"

    def test_irrigation_extracts_crop(self) -> None:
        slots = _extract_slots("irrigation", "كيف أروي القمح")
        assert slots["crop"] == "قمح"

    @pytest.mark.parametrize(
        "text,expected_intent",
        [
            ("شو سعر الطماطم بالسوق", "market"),
            ("تحليل تربة طينية ph 6.5", "soil"),
            ("متى أزرع القمح", "calendar"),
            ("أرني خريطة انتشار المرض", "visual"),
            ("كيفك اليوم", "general"),
        ],
    )
    def test_other_intents(self, text: str, expected_intent: str) -> None:
        assert _detect_intent(text) == expected_intent

    @pytest.mark.parametrize("text", ["مرحبا", "أهلاً", "السلام عليكم", "هاي كيفك"])
    def test_greeting_detector(self, text: str) -> None:
        assert _is_greeting(text) is True

    @pytest.mark.parametrize("text", ["كيف أروي القمح", "شو سعر الطماطم"])
    def test_non_greeting(self, text: str) -> None:
        assert _is_greeting(text) is False

    async def test_liaison_node_sets_greeting_contract(self) -> None:
        """Greeting input must yield LiaisonOutput.greeting == True."""
        update = await liaison_node(_seed("مرحبا"))
        out = coerce(LiaisonOutput, update["agricultural_context"]["liaison_output"])
        assert out.greeting is True
        assert out.intent == "general"
        assert out.reply_ar.strip()  # warm greeting emitted

    async def test_liaison_node_image_sets_vision_contract(self) -> None:
        update = await liaison_node(_seed("شو في بالصورة؟", image_base64="ZmFrZQ=="))
        out = coerce(LiaisonOutput, update["agricultural_context"]["liaison_output"])
        assert out.has_image is True
        assert out.intent == "vision"
        assert out.greeting is False

    async def test_liaison_node_missing_slots(self) -> None:
        """Irrigation query lacking area/age must flag missing_slots."""
        update = await liaison_node(_seed("كيف أروي القمح"))
        out = coerce(LiaisonOutput, update["agricultural_context"]["liaison_output"])
        assert out.intent == "irrigation"
        assert out.slots.get("crop") == "قمح"
        assert out.missing_slots is True


# ─────────────────────────────────────────────────────────────────────────────
# 2. Deterministic orchestrator router
# ─────────────────────────────────────────────────────────────────────────────
class TestOrchestratorRouter:
    def setup_method(self) -> None:
        self.o = get_orchestrator()

    def test_parallel_stage_membership(self) -> None:
        assert self.o.PARALLEL_STAGE == (IRRIGATION, SOIL, MARKET, CALENDAR, RESEARCH)
        for node in (IRRIGATION, SOIL, MARKET, CALENDAR, RESEARCH):
            assert node in self.o.PARALLEL_STAGE
        assert self.o.JOIN == SYNTHESIZER

    @pytest.mark.parametrize(
        "intent,domain_node",
        [
            ("irrigation", IRRIGATION),
            ("soil", SOIL),
            ("market", MARKET),
            ("calendar", CALENDAR),
        ],
    )
    def test_default_route_fans_out_to_matching_domain_agent(self, intent: str, domain_node: str) -> None:
        """Only the ONE domain agent matching this turn's intent fans out with
        Research — not the full PARALLEL_STAGE superset (that's just the
        declared path_map, not what any single run actually returns)."""
        lo = LiaisonOutput(raw_query="سؤال", intent=intent)
        dest = self.o.route(_state("liaison", liaison_output=lo))
        assert isinstance(dest, list)
        assert set(dest) == {domain_node, RESEARCH}

    def test_general_intent_routes_to_research_only(self) -> None:
        """No domain agent matches 'general' — Research alone feeds the join."""
        lo = LiaisonOutput(raw_query="كيفك اليوم", intent="general")
        dest = self.o.route(_state("liaison", liaison_output=lo))
        assert dest == [RESEARCH]

    def test_image_routes_to_vision_first(self) -> None:
        lo = LiaisonOutput(raw_query="شو بالصورة", intent="vision", has_image=True)
        dest = self.o.route(_state("liaison", liaison_output=lo, image_base64="ZmFrZQ=="))
        assert dest == VISION

    def test_greeting_short_circuits_to_end(self) -> None:
        lo = LiaisonOutput(raw_query="مرحبا", greeting=True)
        assert self.o.route(_state("liaison", liaison_output=lo)) == END

    def test_missing_slots_short_circuits_to_end(self) -> None:
        lo = LiaisonOutput(raw_query="كيف أروي القمح", intent="irrigation", missing_slots=True)
        assert self.o.route(_state("liaison", liaison_output=lo)) == END

    def test_path_map_covers_all_liaison_targets(self) -> None:
        pm = self.o.path_map(LIAISON)
        assert set(pm) == {END, VISION, IRRIGATION, SOIL, MARKET, CALENDAR, RESEARCH}

    def test_route_unknown_sender_raises(self) -> None:
        with pytest.raises(ValueError):
            self.o.route(_state("bogus"))


# ─────────────────────────────────────────────────────────────────────────────
# 3. Calculator node — mathematical accuracy
# ─────────────────────────────────────────────────────────────────────────────
class TestCalculatorMath:
    def test_wheat_mid_stage_exact_formula(self) -> None:
        # base(قمح)=420, factor(60d)=1.0, area=5 → 2100 L/day
        r = calculate_irrigation("قمح", area_dunums=5, crop_age_days=60)
        assert r["daily_litres_total"] == pytest.approx(2100)
        assert r["weekly_litres_total"] == pytest.approx(14700)
        assert r["sessions_per_week"] == 2
        assert r["litres_per_session"] == pytest.approx(7350)
        assert r["stage"] == "مرحلة النمو الرئيسية"

    def test_young_stage_factor(self) -> None:
        # factor(20d)=0.55 → 420*0.55*5 = 1155
        r = calculate_irrigation("قمح", area_dunums=5, crop_age_days=20)
        assert r["daily_litres_total"] == pytest.approx(1155)
        assert r["sessions_per_week"] == 1
        assert r["stage"] == "مرحلة النمو المبكر"

    def test_late_stage_factor(self) -> None:
        # factor(120d)=0.75 → 420*0.75*5 = 1575
        r = calculate_irrigation("قمح", area_dunums=5, crop_age_days=120)
        assert r["daily_litres_total"] == pytest.approx(1575)
        assert r["sessions_per_week"] == 1
        assert r["stage"] == "مرحلة النضج"

    def test_unknown_crop_uses_default_base(self) -> None:
        # default base = 600, mid-stage factor 1.0, area 1 → 600
        r = calculate_irrigation("بامية", area_dunums=1, crop_age_days=60)
        assert r["daily_litres_total"] == pytest.approx(600)

    def test_weekly_is_seven_times_daily(self) -> None:
        r = calculate_irrigation("طماطم", area_dunums=3.5, crop_age_days=45)
        assert r["weekly_litres_total"] == pytest.approx(r["daily_litres_total"] * 7, rel=1e-3)

    def test_output_numeric_types_and_ranges(self) -> None:
        r = calculate_irrigation("قطن", area_dunums=10, crop_age_days=70)
        for key in ("daily_litres_total", "weekly_litres_total",
                    "sessions_per_week", "litres_per_session"):
            assert isinstance(r[key], int), f"{key} must be int"
            assert r[key] > 0, f"{key} must be positive"
        assert r["weekly_litres_total"] >= r["daily_litres_total"]

    def test_run_tool_returns_typed_pair(self) -> None:
        slots = {"crop": "قمح", "area_dunums": 5, "crop_age_days": 60}
        tool_result, summary, tool_used = _run_tool("irrigation", slots)
        assert isinstance(tool_result, dict)
        assert tool_result["daily_litres_total"] == pytest.approx(2100)
        assert isinstance(summary, str) and summary.strip()
        assert tool_used == "irrigation"

    def test_run_tool_incomplete_slots_is_noop(self) -> None:
        tool_result, summary, tool_used = _run_tool("irrigation", {"crop": "قمح"})
        assert tool_result is None
        assert summary == ""
        assert tool_used is None

    def test_compute_tips_returns_string(self) -> None:
        tips = _compute_tips("ري القمح في الصيف")
        assert isinstance(tips, str)


# ─────────────────────────────────────────────────────────────────────────────
# 4. End-to-end pipeline output integrity
# ─────────────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def graph():
    return g.get_compiled_graph()


class TestEndToEndIntegrity:
    @pytest.mark.parametrize(
        "message",
        [
            "مرحبا",                                                  # greeting short-circuit
            "كيف أروي القمح",                                          # slot-fill short-circuit
            "احسب الري لمحصول طماطم بمساحة 5 دونم عمرها 60 يوم",        # full irrigation pipeline
            "شو سعر الطماطم بالسوق",                                   # market
            "متى أزرع القمح على ارتفاع 800 متر",                       # calendar
            "أرني خريطة انتشار المرض في حلب",                          # visual / map
        ],
    )
    async def test_reply_is_non_empty_localized(self, graph, message: str) -> None:
        final = await graph.ainvoke(_seed(message))
        reply, _viz = _resolve_output(final["agricultural_context"])
        assert isinstance(reply, str)
        assert reply.strip(), f"empty reply for: {message}"

    async def test_full_pipeline_emits_all_typed_outputs(self, graph) -> None:
        final = await graph.ainvoke(
            _seed("احسب الري لمحصول طماطم بمساحة 5 دونم عمرها 60 يوم")
        )
        ctx = final["agricultural_context"]
        # The two parallel data nodes + the synthesizer join all produced
        # strongly-typed outputs.
        assert isinstance(ctx["liaison_output"], LiaisonOutput)
        assert isinstance(ctx["calculator_output"], CalculatorOutput)
        assert isinstance(ctx["synthesizer_output"], SynthesizerOutput)
        synth = coerce(SynthesizerOutput, ctx["synthesizer_output"])
        assert synth.reply_ar.strip()
        assert synth.synthesizer_done is True

    async def test_greeting_short_circuits_before_data_stage(self, graph) -> None:
        final = await graph.ainvoke(_seed("مرحبا"))
        ctx = final["agricultural_context"]
        assert "calculator_output" not in ctx
        assert "research_output" not in ctx
        assert "synthesizer_output" not in ctx

    async def test_image_flow_runs_vision_then_parallel_join(self, graph) -> None:
        """Vision fans out to Research only (VISION_TARGETS) — an image turn's
        intent is always "vision", which never matches a domain agent, so
        calculator_output is correctly absent, not just unused."""
        final = await graph.ainvoke(_seed("شو في بالصورة؟", image_base64="ZmFrZQ=="))
        ctx = final["agricultural_context"]
        for key in ("liaison_output", "vision_output", "research_output", "synthesizer_output"):
            assert key in ctx, f"missing {key} in image flow"
        assert "calculator_output" not in ctx
        reply, _ = _resolve_output(ctx)
        assert reply.strip()
