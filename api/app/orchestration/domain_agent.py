"""Shared LLM helper for the four domain agents (irrigation/soil/market/calendar).

Each domain agent's real math comes from its deterministic tool function
(``app.tools.*``) exactly as before — this module's only job is turning an
already-computed, already-reliable ``tool_summary`` into a well-phrased
recommendation. It never computes a number itself and is never the source of
truth for one.

Mirrors ``synthesizer_agent.py``'s two-tier call pattern (sync OpenAI call run
via a thread executor, wrapped by an async function with a hard timeout) and
reuses the same provider-agnostic settings (``settings.llm_api_key`` /
``llm_base_url`` / ``llm_model`` — Groq, Gemini, or OpenAI, whichever is
configured) so this needs no separate provider setup.
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.core.llm_health import llm_available, mark_llm_unavailable
from app.core.logging import get_logger

log = get_logger("agro_syria.domain_agent")

# ─────────────────────────────────────────────────────────────────────────────
# Safety-constrained system prompt
# ─────────────────────────────────────────────────────────────────────────────
# The chemical/dosage prohibition below is copied VERBATIM from the
# synthesizer's system prompt fix (app/orchestration/synthesizer_agent.py,
# _SYSTEM_PROMPT) — this is the same non-negotiable rule, not a rewrite of it,
# and applies to all four domains, not just soil/disease.
_BASE_SYSTEM_PROMPT = (
    "أنت وكيل زراعي متخصص في {domain_ar}، جزء من فريق أغرو-سيريا. "
    "تتحدث باللهجة السورية البيضاء. الأرقام والحسابات في البيانات أدناه جاهزة "
    "ومحسوبة مسبقاً من أداة حقيقية وموثوقة — مهمتك حصراً تحويلها إلى توصية "
    "مفهومة ومباشرة للمزارع، وليس إعادة حسابها أو تغييرها. "
    "{domain_flavor} "
    "يمكنك ذكر مبادئ زراعية عامة بثقة. "
    "لكن يُمنع تماماً ذكر اسم مادة كيميائية أو مبيد فطري أو حشري أو منتج تجاري "
    "محدد، أو أي جرعة رقمية، إلا إذا كان مذكوراً حرفياً في المعلومات المزوّدة لك "
    "في هذه الرسالة. إذا احتجت اسم مبيد أو جرعة ولم تجدها في المعطيات، لا تخترعها "
    "أبداً — قل بصراحة إنك غير متأكد من الاسم أو الجرعة المحددة وانصح المزارع "
    "بمراجعة مرشد زراعي أو صيدلية زراعية محلية قبل الاستخدام. "
    "لا تتجاوز 150 كلمة."
)


def _generate_domain_reply_sync(
    domain_ar: str,
    domain_flavor: str,
    tool_result: dict[str, Any] | None,
    tool_summary: str,
    raw_query: str,
    settings: Any,
) -> str:
    """Synchronous LLM call — always run in a thread executor.

    Returns ``tool_summary`` unchanged on any failure (no API key, provider
    marked unavailable, network error, empty response): a domain agent must
    never behave worse than the old deterministic dispatcher, only ever the
    same or better-phrased.
    """
    if not tool_summary:
        # Nothing real to phrase (shouldn't normally happen — a domain node
        # only runs once its tool has produced a result) — nothing to lose by
        # returning it as-is rather than inventing something from a blank slate.
        return tool_summary

    if not (settings.llm_api_key and llm_available()):
        return tool_summary

    import openai

    system_prompt = _BASE_SYSTEM_PROMPT.format(domain_ar=domain_ar, domain_flavor=domain_flavor)
    user_content = (
        f"سؤال المزارع: {raw_query}\n\n"
        f"[بيانات الأداة — المعطيات الحقيقية الوحيدة المسموح الاعتماد عليها]\n{tool_summary}\n\n"
        "حوّل هذه البيانات إلى توصية عملية مباشرة للمزارع باللهجة السورية، دون "
        "تغيير أي رقم عن قيمته الأصلية أعلاه ودون اختراع أي تفصيل غير موجود فيها."
    )

    try:
        client = openai.OpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,   # provider-agnostic, same as synthesizer
            max_retries=0,
            timeout=float(settings.openai_timeout),
        )
        resp = client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0.5,
        )
        content = (resp.choices[0].message.content or "").strip()
        return content or tool_summary
    except Exception as exc:
        if any(x in str(exc).lower() for x in ["429", "quota", "exhausted", "insufficient", "ratelimit", "api key", "permission"]):
            mark_llm_unavailable()
        log.warning(
            "Domain agent LLM call failed for %s (%s) — using deterministic summary",
            domain_ar, type(exc).__name__,
        )
        return tool_summary


async def generate_domain_reply(
    *,
    domain_ar: str,
    domain_flavor: str,
    tool_result: dict[str, Any] | None,
    tool_summary: str,
    raw_query: str,
    settings: Any,
) -> str:
    """Async wrapper — runs the blocking LLM call in a thread under a hard
    timeout. Falls back to ``tool_summary`` unchanged on any failure,
    including the call hanging past the deadline — this must never fail the
    turn or hang it, worst case it is exactly today's dispatcher output.
    """
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(
                _generate_domain_reply_sync,
                domain_ar, domain_flavor, tool_result, tool_summary, raw_query, settings,
            ),
            timeout=float(settings.openai_timeout),
        )
    except Exception as exc:
        log.warning(
            "Domain agent async wrapper failed for %s (%s) — using deterministic summary",
            domain_ar, type(exc).__name__,
        )
        return tool_summary
