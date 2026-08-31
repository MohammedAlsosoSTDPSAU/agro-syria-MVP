"""Input/Output schema governance for the Agro-Syria agent pipeline.

Every node in the LangGraph workflow has an explicit, strongly-typed **input
contract** and **output contract** expressed as Pydantic models. Nothing
unstructured (a bare ``str`` or an ad-hoc ``dict``) is allowed to cross a node
boundary as *logic-bearing* data:

* Each node parses its inputs into an ``*Input`` model (rigorous input
  validation — wrong types raise immediately).
* Each node emits exactly one ``*Output`` model, stored in
  ``agricultural_context`` under a canonical key (see
  :data:`OUTPUT_KEYS`). Downstream nodes read that typed object, never loose
  keys.
* The :class:`~app.orchestration.agent_orchestrator.AgentOrchestrator` validates
  every emitted output against its schema at the handoff boundary and, on
  failure, retries or installs a schema-valid safe fallback.

The free-text ``AIMessage`` content each node also emits is **presentation /
telemetry only** (it drives the UI "chain of thought"); it never carries
inter-node logic, which always flows through these models.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

__all__ = [
    "Intent",
    "Severity",
    "AgentIO",
    "LiaisonInput",
    "LiaisonOutput",
    "VisionInput",
    "VisionOutput",
    "CalculatorInput",
    "CalculatorOutput",
    "ResearchSource",
    "ResearchInput",
    "ResearchOutput",
    "SynthesizerDraft",
    "SynthesizerInput",
    "SynthesizerOutput",
    "OUTPUT_KEYS",
    "OUTPUT_SCHEMAS",
    "INPUT_SCHEMAS",
    "safe_fallback",
    "coerce",
]

# The closed set of intents the Liaison classifier may emit. Keeping this a
# ``Literal`` means an invalid intent is a validation error, not a silent
# mis-route downstream.
Intent = Literal[
    "general",
    "irrigation",
    "soil",
    "market",
    "calendar",
    "visual",
    "vision",
]

Severity = Literal["none", "low", "moderate", "high"]


class AgentIO(BaseModel):
    """Base for all agent I/O contracts.

    ``extra="forbid"`` makes the contract strict: an unexpected field is a
    validation error rather than silently-dropped data. It also makes the models
    safe to use directly as OpenAI structured-output / ``with_structured_output``
    targets (forbidding extras maps to JSON-Schema ``additionalProperties:false``,
    which the structured-output API requires).
    """

    model_config = ConfigDict(extra="forbid", validate_assignment=True)


# ─────────────────────────────────────────────────────────────────────────────
# Liaison — intent detection + slot-fill gatekeeper + image gate
# ─────────────────────────────────────────────────────────────────────────────
class LiaisonInput(AgentIO):
    raw_query: str = ""
    image_base64: str | None = None


class LiaisonOutput(AgentIO):
    raw_query: str
    intent: Intent = "general"
    slots: dict[str, Any] = Field(default_factory=dict)
    greeting: bool = False
    missing_slots: bool = False
    has_image: bool = False
    # Free-text liaison message (greeting / slot-ask / status). Surfaced to the
    # user only when the pipeline short-circuits at the Liaison node.
    reply_ar: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# Vision — objective crop/disease description from an image
# ─────────────────────────────────────────────────────────────────────────────
class VisionInput(AgentIO):
    image_base64: str
    raw_query: str = "ما تشوف في هالصورة؟"


class VisionOutput(AgentIO):
    """Structured visual findings. Also used as the LLM structured-output target."""

    description_ar: str
    detected_symptoms: list[str] = Field(default_factory=list)
    affected_parts: list[str] = Field(default_factory=list)
    severity: Severity = "none"


# ─────────────────────────────────────────────────────────────────────────────
# Calculator — deterministic tool invocation + contextual tips
# ─────────────────────────────────────────────────────────────────────────────
class CalculatorInput(AgentIO):
    intent: Intent
    raw_query: str
    slots: dict[str, Any] = Field(default_factory=dict)
    vision_description: str = ""


class CalculatorOutput(AgentIO):
    tool_result: dict[str, Any] | None = None
    tool_summary: str = ""
    contextual_tips: str = ""
    # Which tool actually ran ("irrigation" | "soil" | "market" | "calendar"),
    # or None if no tool ran (e.g. a general market inquiry with no crop/region
    # yet — intent alone is not a reliable 1:1 signal for this).
    tool_used: str | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Research — dialect-expanded RAG over the knowledge base
# ─────────────────────────────────────────────────────────────────────────────
class ResearchSource(AgentIO):
    book_title: str
    page_num: int | None = None
    source: str


class ResearchInput(AgentIO):
    raw_query: str
    slots: dict[str, Any] = Field(default_factory=dict)
    vision_description: str = ""


class ResearchOutput(AgentIO):
    research_context: str = ""
    research_sources: list[ResearchSource] = Field(default_factory=list)
    vision_rag_bridge: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# Synthesizer — final reply + visualization
# ─────────────────────────────────────────────────────────────────────────────
class SynthesizerDraft(AgentIO):
    """LLM structured-output target for the final reply.

    Deliberately small so the model only produces the natural-language answer and
    its citations; the visualization payload is assembled deterministically by
    the node, never by the LLM.
    """

    reply_ar: str
    citations: list[str] = Field(default_factory=list)


class SynthesizerInput(AgentIO):
    raw_query: str
    tool_summary: str = ""
    contextual_tips: str = ""
    vision_description: str = ""
    research_context: str = ""
    research_sources: list[ResearchSource] = Field(default_factory=list)
    vision_rag_bridge: bool = False


class SynthesizerOutput(AgentIO):
    reply_ar: str
    citations: list[str] = Field(default_factory=list)
    # Visualization stays a plain mapping: it is validated downstream against the
    # API-facing ``VisualizationData`` model in ``app.schema.chat``.
    visualization: dict[str, Any] | None = None
    synthesizer_done: bool = True


# ─────────────────────────────────────────────────────────────────────────────
# Registries — single source of truth for the governance layer
# ─────────────────────────────────────────────────────────────────────────────
# Canonical ``agricultural_context`` key each node writes its output under.
OUTPUT_KEYS: dict[str, str] = {
    "Liaison Agent": "liaison_output",
    "Vision Agent": "vision_output",
    "Agricultural Calculator": "calculator_output",
    "Research Agent": "research_output",
    "Strategic Synthesizer": "synthesizer_output",
}

OUTPUT_SCHEMAS: dict[str, type[AgentIO]] = {
    "Liaison Agent": LiaisonOutput,
    "Vision Agent": VisionOutput,
    "Agricultural Calculator": CalculatorOutput,
    "Research Agent": ResearchOutput,
    "Strategic Synthesizer": SynthesizerOutput,
}

INPUT_SCHEMAS: dict[str, type[AgentIO]] = {
    "Liaison Agent": LiaisonInput,
    "Vision Agent": VisionInput,
    "Agricultural Calculator": CalculatorInput,
    "Research Agent": ResearchInput,
    "Strategic Synthesizer": SynthesizerInput,
}


def coerce(model: type[AgentIO], value: Any) -> AgentIO:
    """Validate ``value`` (a model instance, mapping, or ``None``) into ``model``.

    A model instance is round-tripped through validation so callers always get a
    freshly-validated object; ``None`` validates an empty payload (which succeeds
    only if the model has no required fields, surfacing contract gaps loudly).
    """
    if isinstance(value, model):
        return value
    if isinstance(value, BaseModel):
        return model.model_validate(value.model_dump())
    return model.model_validate(value or {})


def safe_fallback(node_id: str) -> AgentIO:
    """Return a schema-valid, minimal output for ``node_id``.

    Used by the orchestrator when an agent's output cannot be validated even
    after retries — the pipeline degrades gracefully instead of crashing.
    """
    if node_id == "Liaison Agent":
        return LiaisonOutput(
            raw_query="",
            intent="general",
            reply_ar="عذراً، صار في خلل بسيط. ممكن تعيد صياغة سؤالك؟",
        )
    if node_id == "Vision Agent":
        return VisionOutput(
            description_ar="تعذّر تحليل الصورة بدقة في هذه اللحظة.",
            severity="none",
        )
    if node_id == "Agricultural Calculator":
        return CalculatorOutput()
    if node_id == "Research Agent":
        return ResearchOutput()
    if node_id == "Strategic Synthesizer":
        return SynthesizerOutput(
            reply_ar=(
                "عذراً، ما قدرت أجهّز ردّاً متكاملاً هلق. جرّب تسأل مرة تانية "
                "بعد شوي. 🌱"
            ),
        )
    raise ValueError(f"safe_fallback: unknown node '{node_id}'")
