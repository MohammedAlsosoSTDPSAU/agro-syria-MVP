"""Process-wide LLM availability flag (provider-agnostic).

Lives in its own leaf module so both the graph (Vision) and the decoupled
``SynthesizerAgent`` can read/flip it without an import cycle. Set to
unavailable on the first 429 / quota-exceeded / auth error so subsequent
requests skip the doomed API call and fall back to local synthesis
immediately. Works for whichever provider is active (Gemini or OpenAI).
"""

from __future__ import annotations

from app.core.logging import get_logger

log = get_logger("agro_syria.llm_health")

_llm_available: bool = True


def llm_available() -> bool:
    return _llm_available


def mark_llm_unavailable() -> None:
    global _llm_available
    if _llm_available:
        log.warning("LLM marked unavailable — switching to local synthesis for all requests")
    _llm_available = False


def reset_llm_available() -> None:
    """Re-enable the live LLM path (used by startup probes)."""
    global _llm_available
    _llm_available = True


# ── Back-compatible aliases (existing call sites / tests) ────────────────────
openai_available = llm_available
mark_openai_unavailable = mark_llm_unavailable
reset_openai_available = reset_llm_available
