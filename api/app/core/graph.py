"""Agro-Syria LangGraph orchestration — Phase 4.4 (parallel data stage).

Flow (no image) — Calculator ∥ Research run concurrently, then fan in:
  START -> Liaison -> [route] ┬-> Agricultural Calculator ┐
                              └-> Research Agent ──────────┴-> Strategic Synthesizer -> END
                     -> (greeting / slot-ask) -------------------------------------------> END

Flow (with image):
  START -> Liaison -> Vision ┬-> Agricultural Calculator ┐
                            └-> Research Agent ──────────┴-> Strategic Synthesizer -> END

Performance design:
  - Calculator (tools) and Research (RAG) have NO mutual dependency, so they are
    a LangGraph fan-out that executes in parallel and fans in to the Synthesizer.
  - Blocking work (RAG search, tool calls, tips) is offloaded via asyncio.to_thread
    (and asyncio.gather inside the Calculator) so the parallel branches truly
    overlap instead of pinning the event loop.
  - The Synthesizer is isolated as a generation-only SynthesizerAgent
    (app/orchestration/synthesizer_agent.py) — forbidden from tools / RAG / fetch.

Other features:
  - Syrian dialect map for query expansion (dialect_map.json)
  - Location-based RAG result prioritisation; source citations
  - Visualization payload (map / bar chart) attached to ChatResponse
"""

from __future__ import annotations

import asyncio
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph

from app.core.config import get_settings
from app.core.llm_health import mark_openai_unavailable as _mark_openai_unavailable  # re-export for main.py
from app.core.logging import get_logger
from app.core.mock_intelligence import get_contextual_tips, get_mock_vision_description
from app.core.rag_engine import search_knowledge_base
from app.core.state import GraphState
from app.orchestration import get_orchestrator, get_synthesizer_agent
from app.orchestration.schemas import (
    CalculatorInput,
    CalculatorOutput,
    LiaisonInput,
    LiaisonOutput,
    ResearchInput,
    ResearchOutput,
    ResearchSource,
    VisionInput,
    VisionOutput,
    coerce,
)

log = get_logger("agro_syria.graph")

# Deterministic state-machine router/validator — single source of truth for all
# pipeline transitions (replaces ad-hoc, prompt-driven branching).
orchestrator = get_orchestrator()

# Generation-only terminal node, decoupled from data fetching (no tools / RAG).
synthesizer_agent = get_synthesizer_agent()

_DIALECT_MAP_PATH = Path(__file__).resolve().parent / "dialect_map.json"


# ─────────────────────────────────────────────────────────────────────────────
# Dialect map — lazy-loaded singleton
# ─────────────────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_dialect_map() -> dict[str, list[str]]:
    try:
        return json.loads(_DIALECT_MAP_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        log.warning("dialect_map.json load failed (%s) — no query expansion", type(exc).__name__)
        return {}


def _expand_query(query: str) -> str:
    """Append scientific synonyms for any Syrian dialect terms found in *query*."""
    dm = _load_dialect_map()
    if not dm:
        return query
    expansions: list[str] = []
    for dialect_term, scientific_terms in dm.items():
        if dialect_term in query:
            expansions.extend(scientific_terms[:2])  # at most 2 synonyms per match
    if not expansions:
        return query
    return query + " " + " ".join(expansions)


# ─────────────────────────────────────────────────────────────────────────────
# Greeting detection
# ─────────────────────────────────────────────────────────────────────────────
_GREETING_TOKENS = frozenset([
    "مرحبا", "مرحبً", "هلا", "هلو", "أهلا", "اهلا", "أهلاً", "اهلاً",
    "السلام", "سلام", "صباح", "مساء", "هاي", "hi", "hello", "hey",
    "كيفك", "شلونك", "وينك", "خير",
])


def _is_greeting(text: str) -> bool:
    # Strip ALL punctuation (including mid-sentence commas) before splitting
    cleaned = re.sub(r"[،,؟?!.،؟\s]+", " ", text).strip().lower()
    words = cleaned.split()
    return len(words) <= 5 and any(w in _GREETING_TOKENS for w in words)


# ─────────────────────────────────────────────────────────────────────────────
# Intent detection
# ─────────────────────────────────────────────────────────────────────────────
_INTENT_MAP: list[tuple[list[str], str]] = [
    # visual must come before irrigation — "خريطة" contains the substring "ري"
    (["خريطة", "مخطط بياني", "أرني خريطة", "اعطيني خريطة", "وين الإصابة",
      "توزيع المحاصيل", "انتشار المرض", "map", "chart", "أين ينتشر",
      "خريطة سوريا", "محافظات سوريا"], "visual"),
    (["ري ", " ري", "روي", "سقي", "مياه", "سقاية", "رشاش", "تنقيط", "احسب الري", "كمية مياه"], "irrigation"),
    (["تربة", "ph", "تحليل تربة", "خاك", "سماد", "تسميد", "فوسفور", "نيتروجين", "بوتاسيوم"], "soil"),
    (["سعر", "أسعار", "سوق", "بيع", "تسويق", "أرباح", "ربح"], "market"),
    (["موعد زراعة", "بذر", "حصاد", "تقويم", "متى أزرع", "متى أحصد"], "calendar"),
]


def _detect_intent(text: str) -> str:
    # Pad with spaces so short keywords can match at word boundaries
    low = " " + text.lower() + " "
    for keywords, intent in _INTENT_MAP:
        if any(kw in low for kw in keywords):
            return intent
    return "general"


# ─────────────────────────────────────────────────────────────────────────────
# Slot extraction
# ─────────────────────────────────────────────────────────────────────────────
_CROP_NAMES = [
    "قمح", "شعير", "ذرة", "طماطم", "بندورة", "خيار", "بطاطا", "بطاطس",
    "زيتون", "عنب", "تفاح", "بصل", "ثوم", "فول", "عدس", "قطن",
]

_REGION_NAMES = [
    "دمشق", "حلب", "حمص", "حماة", "اللاذقية", "درعا",
    "دير الزور", "الرقة", "إدلب", "السويداء", "القنيطرة", "طرطوس",
    "الحسكة", "ريف دمشق",
]


def _extract_crop(text: str) -> str | None:
    for c in _CROP_NAMES:
        if c in text:
            return "طماطم" if c == "بندورة" else "بطاطا" if c == "بطاطس" else c
    return None


def _extract_region(text: str) -> str | None:
    for r in _REGION_NAMES:
        if r in text:
            return r
    return None


_ARABIC_DIGIT_MAP = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def _normalize_digits(text: str) -> str:
    return text.translate(_ARABIC_DIGIT_MAP)


def _extract_slots(intent: str, text: str) -> dict[str, Any]:
    norm = _normalize_digits(text)
    slots: dict[str, Any] = {}
    crop = _extract_crop(text)
    if crop:
        slots["crop"] = crop

    if intent == "irrigation":
        area_m = re.search(r"(\d+(?:\.\d+)?)\s*(?:دونم|دونمات|دونمة|هكتار)", norm)
        if area_m:
            slots["area_dunums"] = float(area_m.group(1))
        age_m = re.search(r"(\d+)\s*(?:يوم|يوماً|أيام)", norm)
        slots["crop_age_days"] = int(age_m.group(1)) if age_m else None

    elif intent == "soil":
        ph_m = re.search(r"ph\s*[:=]?\s*(\d+(?:\.\d+)?)", norm, re.IGNORECASE)
        if ph_m:
            slots["ph"] = float(ph_m.group(1))
        for soil_type in ["طينية", "رملية", "طميية", "صخرية", "جيرية"]:
            if soil_type in text:
                slots["soil_type"] = soil_type
                break
        days_m = re.search(r"(\d+)\s*(?:يوم|يوماً|أيام|شهر|أشهر)", norm)
        if days_m:
            val = int(days_m.group(1))
            if "شهر" in text or "أشهر" in text:
                val *= 30
            slots["last_fertilized_days"] = val

    elif intent == "market":
        region = _extract_region(text)
        if region:
            slots["region"] = region

    elif intent == "calendar":
        alt_m = re.search(r"(\d+)\s*(?:متر|م\b|m\b)", norm, re.IGNORECASE)
        if alt_m:
            slots["altitude"] = int(alt_m.group(1))

    # Always try to extract region for location-aware RAG
    if not slots.get("region"):
        region = _extract_region(text)
        if region:
            slots["region"] = region

    return slots


def _apply_user_context_fallback(slots: dict[str, Any], user_context: dict[str, Any] | None) -> None:
    """Fill missing region/crop slots from the farmer's registered profile.

    ``user_context`` (preferred_province / active_crops) comes from the
    frontend's حقولي/المحاصيل pages; it only fills gaps the message text
    itself didn't specify — an explicit mention in the query always wins.
    """
    if not user_context:
        return
    if not slots.get("region") and user_context.get("preferred_province"):
        slots["region"] = user_context["preferred_province"]
    if not slots.get("crop") and user_context.get("active_crops"):
        crops = user_context["active_crops"]
        if crops:
            slots["crop"] = crops[0]


def _merge_pending_slots(pending: dict[str, Any], text: str) -> tuple[str, dict[str, Any]]:
    """Merge a follow-up message's slots into a prior turn's pending slot-ask.

    ``pending`` is ``{"intent": ..., "slots": {...}}`` saved by the chat route
    when the previous turn ended in a slot-ask (see ``app.core.session_store``).
    Slots are re-extracted from ``text`` *using the pending intent* — a bare
    follow-up like "45 يوم" carries no keyword that would let ``_detect_intent``
    recover "irrigation" on its own, so the pending intent is what makes the
    extraction regex (crop age, area, ph, ...) apply at all. New values fill
    gaps in the old slots; a slot the message actually mentions overrides the
    old value, but a slot the message doesn't mention never clobbers a
    previously known one with ``None``.
    """
    intent = pending.get("intent") or "general"
    old_slots = dict(pending.get("slots") or {})
    new_slots = _extract_slots(intent, text)
    merged = {**old_slots, **{k: v for k, v in new_slots.items() if v is not None}}
    return intent, merged


def _build_slot_ask(intent: str, slots: dict[str, Any]) -> str | None:
    missing: list[str] = []

    if intent == "irrigation":
        if not slots.get("crop"):
            missing.append("نوع الزرع")
        if not slots.get("area_dunums"):
            missing.append("مساحة الأرض (بالدونم)")
        if slots.get("crop_age_days") is None:
            missing.append("عمر المحصول (بالأيام)")

    elif intent == "soil":
        if slots.get("ph") is None:
            missing.append("قيمة الـ pH")
        if not slots.get("soil_type"):
            missing.append("نوع التربة (طينية / رملية / طميية / جيرية)")
        if slots.get("last_fertilized_days") is None:
            missing.append("آخر مرة سمّدت (كم يوم فات؟)")

    elif intent == "market":
        if not slots.get("crop"):
            missing.append("اسم المحصول")
        if not slots.get("region"):
            missing.append("المنطقة أو المحافظة")

    elif intent == "calendar":
        if not slots.get("crop"):
            missing.append("اسم المحصول")
        if slots.get("altitude") is None:
            missing.append("ارتفاع منطقتك عن سطح البحر (بالمتر تقريباً)")

    if not missing:
        return None

    parts = " و".join(missing)
    return f"من عيوني، بس قديش {parts}؟ هيك بقدر أعطيك حساب دقيق."


# ─────────────────────────────────────────────────────────────────────────────
# System prompts
# ─────────────────────────────────────────────────────────────────────────────
# NOTE: the synthesizer's system prompt lives with the SynthesizerAgent in
# app/orchestration/synthesizer_agent.py (generation is decoupled from this
# data-fetching graph module).

_VISION_SYSTEM_PROMPT = (
    "أنت خبير المعاينة البصرية في منصة أغرو-سيريا. "
    "مهمتك حصراً وصف ما تراه في الصورة الزراعية بدقة وموضوعية باللهجة السورية. "
    "ركّز على: لون الأوراق والثمار، وجود بقع أو تلف، شكل النبات، أي علامات مرضية واضحة. "
    "لا تقدّم توصيات — فقط صِف ما تراه بوضوح في ٣–٥ جمل."
)


# ─────────────────────────────────────────────────────────────────────────────
# Node: Liaison  (intent detect + slot-fill gatekeeper + image gate)
# ─────────────────────────────────────────────────────────────────────────────
async def liaison_node(state: GraphState) -> dict[str, Any]:
    user_msg = next(
        (m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage)), "",
    )
    ctx = state.get("agricultural_context", {})

    # Rigorous input validation — wrong types raise before any work happens.
    inp = LiaisonInput(raw_query=str(user_msg), image_base64=ctx.get("image_base64"))
    has_image = bool(inp.image_base64)

    pending = ctx.get("pending")
    log.info("وكيل التواصل — image=%s msg=%.60s pending=%s", has_image, inp.raw_query, bool(pending))

    if has_image:
        out = LiaisonOutput(
            raw_query=inp.raw_query or "ما تشوف في هالصورة؟",
            intent="vision",
            has_image=True,
            reply_ar="وصلتني صورتك، عم بحللها مع الخبراء...",
        )
        return _liaison_update(out)

    if _is_greeting(inp.raw_query):
        out = LiaisonOutput(
            raw_query=inp.raw_query,
            intent="general",
            greeting=True,
            reply_ar=(
                "أهلاً وسهلاً! 🌿 أنا أغرو-سيريا، خبيرك الزراعي الذكي. "
                "يسعدني أكون رفيقك في كل ما يخص أرضك وزراعتك. "
                "شو بدك تعرف اليوم؟"
            ),
        )
        return _liaison_update(out)

    if pending:
        fresh_intent = _detect_intent(inp.raw_query)
        if fresh_intent in ("general", pending.get("intent")):
            # Bare follow-up (e.g. "45 يوم") or a same-topic continuation —
            # merge into the pending slot-ask instead of starting fresh.
            intent, slots = _merge_pending_slots(pending, inp.raw_query)
        else:
            # The message clearly switched topics — don't force it into the
            # old pending slot-ask.
            intent = fresh_intent
            slots = _extract_slots(intent, inp.raw_query)
    else:
        intent = _detect_intent(inp.raw_query)
        slots = _extract_slots(intent, inp.raw_query)
    _apply_user_context_fallback(slots, ctx.get("user_context"))
    slot_ask = _build_slot_ask(intent, slots) if intent != "general" else None

    if slot_ask:
        log.info("slot-filling ask — intent=%s", intent)
        out = LiaisonOutput(
            raw_query=inp.raw_query,
            intent=intent,
            slots=slots,
            missing_slots=True,
            reply_ar=slot_ask,
        )
        return _liaison_update(out)

    out = LiaisonOutput(
        raw_query=inp.raw_query,
        intent=intent,
        slots=slots,
        reply_ar="عم بجهزلك تقرير من فريق الخبراء...",
    )
    return _liaison_update(out)


def _liaison_update(out: LiaisonOutput) -> dict[str, Any]:
    """Build the Liaison state update from its validated output model."""
    return {
        "messages": [AIMessage(content=out.reply_ar, name="liaison")],
        "sender": "liaison",
        "agricultural_context": {"liaison_output": out},
    }


# ─────────────────────────────────────────────────────────────────────────────
# Node: Vision Agent  (GPT-4o vision → objective crop/disease description)
# ─────────────────────────────────────────────────────────────────────────────
async def vision_node(state: GraphState) -> dict[str, Any]:
    ctx = state.get("agricultural_context", {})
    liaison = coerce(LiaisonOutput, ctx["liaison_output"])

    # Rigorous input validation for the vision contract.
    inp = VisionInput(
        image_base64=ctx.get("image_base64") or "",
        raw_query=liaison.raw_query or "ما تشوف في هالصورة؟",
    )
    settings = get_settings()

    log.info("خبير المعاينة البصرية — analyzing image (%d bytes b64)", len(inp.image_base64))

    findings: VisionOutput | None = None
    if settings.llm_api_key and inp.image_base64:
        try:
            findings = await asyncio.wait_for(
                _call_vision_llm(inp.image_base64, inp.raw_query, settings),
                timeout=float(settings.openai_timeout),
            )
        except Exception as exc:
            log.warning("Vision LLM call failed (%s) — using mock", type(exc).__name__)

    if findings is None:
        findings = VisionOutput(description_ar=get_mock_vision_description())

    return {
        "messages": [AIMessage(content=findings.description_ar, name="vision")],
        "sender": "vision_agent",
        "agricultural_context": {"vision_output": findings},
    }


async def _call_vision_llm(image_b64: str, query: str, settings: Any) -> VisionOutput:
    """Vision LLM call constrained to the :class:`VisionOutput` schema.

    Provider-agnostic via the OpenAI-compatible interface (Gemini's endpoint or
    native OpenAI). Uses LangChain's ``with_structured_output`` so the model must
    return an object matching the contract (description + symptoms + severity) —
    no free-text parsing, no unstructured string crossing the node boundary.
    """
    from langchain_openai import ChatOpenAI

    raw_b64 = image_b64.split(",", 1)[1] if "," in image_b64 else image_b64

    llm = ChatOpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,   # Gemini OpenAI-compatible endpoint, or None for OpenAI
        model=settings.llm_model,
        temperature=0.3,
        max_tokens=500,
        timeout=settings.openai_timeout,
        max_retries=0,
    ).with_structured_output(VisionOutput)

    result = await llm.ainvoke([
        {"role": "system", "content": _VISION_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": query},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{raw_b64}",
                        "detail": "low",
                    },
                },
            ],
        },
    ])
    # ``with_structured_output(VisionOutput)`` returns a VisionOutput instance.
    return coerce(VisionOutput, result)


# ─────────────────────────────────────────────────────────────────────────────
# Node: Agricultural Calculator  (tool invocation + keyword tips)
# ─────────────────────────────────────────────────────────────────────────────
async def field_agent_node(state: GraphState) -> dict[str, Any]:
    ctx = state.get("agricultural_context", {})
    liaison = coerce(LiaisonOutput, ctx["liaison_output"])
    vision = ctx.get("vision_output")
    vision_description = coerce(VisionOutput, vision).description_ar if vision else ""

    # Rigorous input validation for the calculator contract.
    inp = CalculatorInput(
        intent=liaison.intent,
        raw_query=liaison.raw_query,
        slots=liaison.slots,
        vision_description=vision_description,
    )

    log.info("عميل الحقل — intent=%s has_vision=%s", inp.intent, bool(vision_description))

    # The tool computation and the contextual-tips lookup are independent, so
    # run them concurrently — each offloaded to a worker thread so this node
    # never blocks the event loop while it runs in parallel with the Research
    # node (LangGraph fan-out).
    combined_query = f"{inp.raw_query} {vision_description}".strip()
    (tool_result, tool_summary), tips_text = await asyncio.gather(
        asyncio.to_thread(_run_tool, inp.intent, inp.slots),
        asyncio.to_thread(_compute_tips, combined_query),
    )

    field_content = tool_summary or (
        f"👁 **وصف بصري مستلم**\n{vision_description}" if vision_description else "جاري التحليل..."
    )

    out = CalculatorOutput(
        tool_result=tool_result,
        tool_summary=tool_summary,
        contextual_tips=tips_text,
    )
    return {
        "messages": [AIMessage(content=field_content, name="field")],
        "sender": "field_agent",
        "agricultural_context": {"calculator_output": out},
    }


def _compute_tips(combined_query: str) -> str:
    """Keyword-based contextual tips (blocking → offloaded to a thread)."""
    tips = get_contextual_tips(combined_query)
    return "\n\n".join(tips[:2]) if tips else ""


def _run_tool(intent: str, slots: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    """Invoke the single tool matching *intent* (blocking → offloaded to a thread).

    Returns ``(tool_result, tool_summary)``. Only one tool runs per request; the
    branches are mutually exclusive by intent + slot availability.
    """
    tool_result: dict[str, Any] | None = None
    tool_summary = ""

    if intent == "irrigation" and slots.get("crop") and slots.get("area_dunums"):
        from app.tools.irrigation_tool import calculate_irrigation
        tool_result = calculate_irrigation(
            crop=slots["crop"],
            area_dunums=float(slots["area_dunums"]),
            crop_age_days=int(slots.get("crop_age_days") or 60),
        )
        tool_summary = (
            f"📊 **حساب الري — {tool_result['crop']}**\n"
            f"• المساحة: {tool_result['area_dunums']} دونم · {tool_result['stage']}\n"
            f"• احتياج يومي: **{tool_result['daily_litres_total']:,} لتر**\n"
            f"• أسبوعياً: {tool_result['weekly_litres_total']:,} لتر "
            f"({tool_result['sessions_per_week']} جلسات — {tool_result['litres_per_session']:,} لتر/جلسة)"
        )

    elif intent == "soil" and slots.get("ph") is not None and slots.get("soil_type"):
        from app.tools.soil_health_tool import analyze_soil_needs
        tool_result = analyze_soil_needs(
            ph=float(slots["ph"]),
            soil_type=slots["soil_type"],
            last_fertilized_days=int(slots.get("last_fertilized_days") or 30),
        )
        tool_summary = (
            f"🧪 **تحليل التربة**\n"
            f"• pH: {tool_result['ph']} → {tool_result['ph_status']}\n"
            f"• الإجراء: {tool_result['ph_action']}\n"
            f"• {tool_result['soil_note']}\n"
            f"• تسميد: {tool_result['fertilisation_urgency']} — {tool_result['fertilisation_note']}"
        )

    elif intent == "market" and slots.get("crop") and slots.get("region"):
        from app.tools.market_tool import get_syrian_market_prices
        tool_result = get_syrian_market_prices(crop=slots["crop"], region=slots["region"])
        if "error" in tool_result:
            tool_summary = f"⚠️ {tool_result['error']}"
        else:
            tool_summary = (
                f"📈 **أسعار السوق — {tool_result['crop']} في {tool_result['region']}**\n"
                f"• السعر الحالي: **{tool_result['price_per_kg_syp']:,} ل.س/كغ**\n"
                f"• الاتجاه الأسبوعي: {tool_result['weekly_trend']}\n"
                f"• {tool_result['market_note']}\n"
                f"• أفضل وقت للبيع: {tool_result['best_sell_window']}\n\n"
                f"📊 **للتحليل التفصيلي والرسوم البيانية:** افتح [لوحة السوق الزراعي](/dashboard/market)"
            )
    elif intent == "market" and not (slots.get("crop") and slots.get("region")):
        # General market inquiry → guide to the dashboard
        tool_summary = (
            "📊 **لوحة السوق الزراعي**\n"
            "يمكنك متابعة أسعار المحاصيل وتحليل الإنتاجية الإقليمية في لوحة السوق المتكاملة.\n\n"
            "**افتح لوحة السوق** من القائمة الجانبية ← *لوحة السوق* للاطلاع على:\n"
            "• رسوم بيانية لتطور أسعار القمح والقطن والطماطم وزيت الزيتون\n"
            "• مقارنة إنتاجية المحافظات السورية\n"
            "• خريطة كثافة الإنتاج التفاعلية\n"
            "• نشرة أخبار وزارة الزراعة\n\n"
            "أو أخبرني باسم المحصول والمنطقة وسأعطيك سعراً مباشراً."
        )

    elif intent == "calendar" and slots.get("crop") and slots.get("altitude") is not None:
        from app.tools.calendar_tool import get_planting_schedule
        tool_result = get_planting_schedule(crop=slots["crop"], location_altitude=int(slots["altitude"]))
        notes = f"\n• ملاحظة: {tool_result['agronomic_notes']}" if tool_result["agronomic_notes"] else ""
        tool_summary = (
            f"📅 **التقويم الزراعي — {tool_result['crop']}**\n"
            f"• المنطقة: {tool_result['altitude_zone']}\n"
            f"• موعد الزراعة: **{tool_result['sowing_window']}**\n"
            f"• موعد الحصاد: **{tool_result['harvest_window']}**"
            f"{notes}"
        )

    return tool_result, tool_summary


# Minimum RAG similarity score to treat a chunk as real grounding rather than
# noise. Calibrated empirically against the TF-IDF backend: clearly on-topic
# queries ("أعراض صدأ القمح", "مبيد فطري لصدأ القمح") scored 0.38-0.46, while a
# vague, off-topic follow-up ("45 يوم" alone) scored 0.34-0.39 — a bare number
# that still surfaced the wheat-rust PDF as if it were relevant, which the
# synthesizer then trusted enough to fabricate a diagnosis and fungicide names
# from. The two score bands overlap (TF-IDF is not a clean relevance signal),
# so this threshold deliberately sits above the confirmed-noise ceiling rather
# than trying to also keep weaker legitimate matches: a missed real match only
# costs a clarification question, while a false positive here is what causes
# fabricated pesticide advice — asymmetric risk, not a symmetric tradeoff.
_MIN_RAG_SCORE = 0.40


# ─────────────────────────────────────────────────────────────────────────────
# Node: Research Agent  (Vision-RAG bridge + knowledge-base search)
# ─────────────────────────────────────────────────────────────────────────────
async def research_node(state: GraphState) -> dict[str, Any]:
    ctx = state.get("agricultural_context", {})
    liaison = coerce(LiaisonOutput, ctx["liaison_output"])
    vision = ctx.get("vision_output")
    vision_description = coerce(VisionOutput, vision).description_ar if vision else ""

    # Rigorous input validation for the research contract.
    inp = ResearchInput(
        raw_query=liaison.raw_query,
        slots=liaison.slots,
        vision_description=vision_description,
    )
    query = inp.raw_query
    slots = inp.slots
    user_region: str | None = slots.get("region")
    from_vision = bool(vision_description)

    # ── Query expansion via dialect map ───────────────────────────────
    if from_vision:
        base_query = f"{vision_description} {query}".strip()
    else:
        base_query = query

    expanded_query = _expand_query(base_query)
    if expanded_query != base_query:
        log.info("وكيل البحث — dialect expansion added: %.60s", expanded_query[len(base_query):])

    log.info("وكيل البحث — vision=%s region=%s query=%.80s", from_vision, user_region, expanded_query)

    # RAG retrieval is CPU/IO-blocking — offload to a worker thread so this node
    # truly overlaps the Calculator node (LangGraph fan-out) instead of pinning
    # the event loop.
    results = await asyncio.to_thread(search_knowledge_base, expanded_query, 4)  # may discard after boost

    # ── Location-based prioritisation ────────────────────────────────
    if user_region and results:
        for r in results:
            if user_region in r.get("text", ""):
                r["score"] = round(r["score"] * 1.20, 4)  # 20% boost for region match
        results.sort(key=lambda x: x["score"], reverse=True)
        log.info("وكيل البحث — applied location boost for region=%s", user_region)

    # Drop anything that doesn't clear the relevance bar *before* slicing to
    # top-3 — a weak/irrelevant match must never reach the synthesizer looking
    # like a found result just because it was the "best of a bad bunch".
    below_threshold = [r["score"] for r in results if r["score"] < _MIN_RAG_SCORE]
    results = [r for r in results if r["score"] >= _MIN_RAG_SCORE][:3]
    if below_threshold:
        log.info(
            "وكيل البحث — discarded %d chunk(s) below relevance threshold %.2f (scores=%s)",
            len(below_threshold), _MIN_RAG_SCORE, below_threshold,
        )

    # ── Build citation metadata ───────────────────────────────────────
    research_sources: list[ResearchSource] = []
    if results:
        passages = "\n\n---\n\n".join(
            f"[{r.get('book_title', r['source'])} | ص.{r.get('page_num', '?')} | score {r['score']:.2f}]\n{r['text']}"
            for r in results
        )
        top_score = results[0].get("score", 0)
        log.info("RAG retrieved %d chunks (top score=%.3f)", len(results), top_score)

        research_sources = [
            ResearchSource(
                book_title=r.get("book_title", r["source"]),
                page_num=r.get("page_num"),
                source=r["source"],
            )
            for r in results
        ]

        if from_vision:
            status_msg = (
                f"خبير الرؤية رصد أعراضاً... "
                f"وجدت {len(results)} نتيجة في الكتب الزراعية تتعلق بما شُوهد."
            )
        else:
            status_msg = f"وجدت {len(results)} نتيجة في المكتبة الزراعية السورية."
    else:
        passages = ""
        status_msg = "لم أجد معلومات موثوقة بالمكتبة — رح أطلب توضيح بدل ما أخمّن."
        log.info("RAG returned no results above relevance threshold")

    out = ResearchOutput(
        research_context=passages,
        research_sources=research_sources,
        vision_rag_bridge=from_vision,
    )
    return {
        "messages": [AIMessage(content=status_msg, name="research")],
        "sender": "research_agent",
        "agricultural_context": {"research_output": out},
    }


# ─────────────────────────────────────────────────────────────────────────────
# Graph compilation (singleton)
# ─────────────────────────────────────────────────────────────────────────────
@lru_cache(maxsize=1)
def get_compiled_graph():
    builder: StateGraph = StateGraph(GraphState)

    # Node implementations, keyed by the orchestrator's canonical node ids so
    # the registry and the routing table can never drift apart. The Synthesizer
    # is the decoupled, generation-only SynthesizerAgent (no tools / RAG).
    node_impls = {
        "Liaison Agent":           liaison_node,
        "Vision Agent":            vision_node,
        "Agricultural Calculator": field_agent_node,
        "Research Agent":          research_node,
        "Strategic Synthesizer":   synthesizer_agent.node,
    }

    # Wrap every node in the orchestrator's schema guard: its output is
    # validated against the agent's Pydantic contract at the handoff boundary,
    # with retry + safe fallback on malformed output.
    for node in orchestrator.PIPELINE:
        builder.add_node(node, orchestrator.guard(node, node_impls[node]))

    liaison = orchestrator.PIPELINE[0]
    vision = "Vision Agent"

    # START -> Liaison. The only runtime decision is after Liaison: stop (END),
    # go to Vision first (image), or fan out to the parallel data stage.
    builder.add_edge(START, liaison)
    builder.add_conditional_edges(liaison, orchestrator.route, orchestrator.path_map(liaison))

    # Vision fans out to the parallel data stage; the two independent data nodes
    # (Calculator = tools, Research = RAG) run concurrently, then fan in to the
    # generation-only Synthesizer (the join). All static — no runtime decision.
    for data_node in orchestrator.PARALLEL_STAGE:
        builder.add_edge(vision, data_node)            # image flow: Vision -> {Calc, Research}
        builder.add_edge(data_node, orchestrator.JOIN)  # fan-in -> Synthesizer
    builder.add_edge(orchestrator.JOIN, END)

    compiled = builder.compile()
    log.info(
        "LangGraph compiled — Liaison -> [Vision?] -> {%s} (parallel) -> %s | END",
        ", ".join(orchestrator.PARALLEL_STAGE), orchestrator.JOIN,
    )
    return compiled
