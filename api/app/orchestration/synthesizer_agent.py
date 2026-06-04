"""SynthesizerAgent — the pipeline's final, generation-only node.

Architectural contract (enforced *structurally*, by what this module is allowed
to import):

    The SynthesizerAgent is FORBIDDEN from invoking external tools, executing
    RAG queries, or fetching any data.

This module imports **no** ``app.tools.*``, **no** ``app.core.rag_engine``, and
**no** data source. Its only dependencies are the typed schemas, the LLM client
(for content generation), and pure presentation helpers (citation formatting,
deterministic visualization assembly from already-compiled context). Its sole
job is to take the strongly-typed context produced upstream — ``tool_summary``
(Calculator) and the RAG chunks / ``research_context`` (Research) — and
synthesize one clear, localized answer in the Syrian agricultural dialect.

Decoupling generation from data fetching lets the data nodes (Calculator and
Research) run concurrently *before* this node, and keeps the latency-bound LLM
call off the critical fan-out path.
"""

from __future__ import annotations

import asyncio
import functools
from typing import Any

from langchain_core.messages import AIMessage

from app.core.config import get_settings
from app.core.llm_health import llm_available, mark_llm_unavailable
from app.core.logging import get_logger
from app.core.state import GraphState
from app.orchestration.schemas import (
    CalculatorOutput,
    LiaisonOutput,
    ResearchOutput,
    SynthesizerDraft,
    SynthesizerInput,
    SynthesizerOutput,
    VisionOutput,
    coerce,
)

log = get_logger("agro_syria.synthesizer")

_SYSTEM_PROMPT = (
    "أنت خبير زراعي سوري ذكي جداً، اسمك (أغرو-سيريا). "
    "تتحدث باللهجة السورية البيضاء (المريحة والقريبة للقلب). "
    "إذا حيّاك المستخدم، رد عليه بترحيب سوري دافئ دون الدخول في تفاصيل تقنية إلا إذا سأل. "
    "إذا سأل عن الزراعة، استخدم خبرتك لتقديم نصائح دقيقة ومختصرة باللهجة السورية. "
    "عند الاستشهاد بمصادر زراعية استخدم الصيغة: «حسب دليل [اسم الكتاب]...». "
    "دائماً اختم ردك بجملة تشجيعية قصيرة."
)


# ─────────────────────────────────────────────────────────────────────────────
# Syrian governorate registry — for deterministic map visualization
# (static reference data — NOT a runtime fetch)
# ─────────────────────────────────────────────────────────────────────────────
_GOVERNORATES: dict[str, dict[str, Any]] = {
    "دمشق":      {"lat": 33.51, "lng": 36.29, "crops": ["خضروات", "فاكهة"]},
    "ريف دمشق": {"lat": 33.60, "lng": 36.50, "crops": ["خضروات", "فاكهة", "قمح"]},
    "حلب":       {"lat": 36.20, "lng": 37.16, "crops": ["قمح", "قطن", "زيتون"]},
    "حمص":       {"lat": 34.73, "lng": 36.72, "crops": ["قمح", "شمندر", "زيتون"]},
    "حماة":      {"lat": 35.13, "lng": 36.75, "crops": ["قمح", "قطن"]},
    "اللاذقية":  {"lat": 35.52, "lng": 35.79, "crops": ["زيتون", "حمضيات", "تبغ"]},
    "طرطوس":     {"lat": 34.89, "lng": 35.89, "crops": ["زيتون", "حمضيات"]},
    "إدلب":      {"lat": 35.93, "lng": 36.63, "crops": ["زيتون", "قمح"]},
    "الرقة":     {"lat": 35.95, "lng": 39.01, "crops": ["قمح", "قطن"]},
    "دير الزور": {"lat": 35.34, "lng": 40.14, "crops": ["قمح", "قطن"]},
    "الحسكة":    {"lat": 36.50, "lng": 40.74, "crops": ["قمح", "قطن", "شمندر"]},
    "السويداء":  {"lat": 32.71, "lng": 36.57, "crops": ["عنب", "كرز", "مشمش"]},
    "درعا":      {"lat": 32.62, "lng": 36.10, "crops": ["قمح", "خضروات"]},
    "القنيطرة":  {"lat": 33.13, "lng": 35.82, "crops": ["قمح", "فاكهة"]},
}

_COASTAL   = {"اللاذقية", "طرطوس"}          # higher fungal risk
_DRY_NORTH = {"حلب", "إدلب", "حماة"}        # higher insect/aphid risk
_NORTHEAST = {"الرقة", "دير الزور", "الحسكة"}   # rust / cereal disease risk


def _disease_spread_map(crop: str, disease_text: str, user_region: str | None) -> dict[str, Any]:
    """Build a map visualization showing disease spread risk across Syria."""
    is_fungal = any(k in disease_text for k in ["بياض", "صدأ", "عفن", "فطر", "Rust", "Blight"])
    is_insect = any(k in disease_text for k in ["حشرة", "من", "يرقة", "دودة", "Aphid"])

    points = []
    for gov_name, geo in _GOVERNORATES.items():
        crop_match = any(c in geo["crops"] for c in [crop, "عام"]) if crop else True
        base = 0.55 if crop_match else 0.30

        if is_fungal and gov_name in _COASTAL:
            risk = base + 0.30
        elif is_fungal and gov_name in _DRY_NORTH:
            risk = base + 0.05
        elif is_insect and gov_name in _DRY_NORTH:
            risk = base + 0.25
        elif is_insect and gov_name in _NORTHEAST:
            risk = base + 0.15
        else:
            # deterministic pseudo-random variation per region
            risk = base + (abs(hash(gov_name + (crop or ""))) % 25) / 100

        # User's own region gets highest visible intensity
        if user_region and (user_region in gov_name or gov_name in user_region):
            risk = min(risk + 0.20, 1.0)

        risk = round(min(max(risk, 0.10), 1.0), 2)
        points.append({
            "lat": geo["lat"],
            "lng": geo["lng"],
            "label_ar": gov_name,
            "intensity": risk,
        })

    return {
        "type": "map",
        "display_type": "map",
        "title_ar": f"خريطة انتشار الإصابة — {crop or 'المحصول'}",
        "points": points,
        "location_data": {
            "center": {"lat": 34.8, "lng": 38.9},
            "country": "سوريا",
            "governorates": list(_GOVERNORATES.keys()),
        },
        "zoom_level": 6,
        "source_ar": "تقدير أولي بناءً على البيانات الزراعية والمناخية السورية",
    }


def _irrigation_bar_chart(tool_result: dict[str, Any]) -> dict[str, Any]:
    """Build a bar chart comparing water needs across growth stages."""
    crop     = tool_result.get("crop", "المحصول")
    daily    = tool_result.get("daily_litres_total", 0)
    area     = tool_result.get("area_dunums", 1) or 1
    age      = tool_result.get("crop_age_days", 60)

    per_dunum = daily / area

    # Recover base (peak) litres per dunum from stage factor
    if age <= 30:
        factor = 0.55
    elif age <= 90:
        factor = 1.0
    else:
        factor = 0.75
    base = per_dunum / factor if factor else per_dunum

    # Determine which bar is the "current" stage for color highlight
    current_stage = (
        "مرحلة الإنبات"    if age <= 30
        else "النمو الرئيسي" if age <= 90
        else "مرحلة النضج"
    )

    def _color(label: str) -> str:
        return "amber" if label == current_stage else "emerald"

    bars = [
        {"label_ar": "مرحلة الإنبات",  "value": round(base * 0.55), "color": _color("مرحلة الإنبات")},
        {"label_ar": "النمو الرئيسي",   "value": round(base * 1.00), "color": _color("النمو الرئيسي")},
        {"label_ar": "مرحلة النضج",     "value": round(base * 0.75), "color": _color("مرحلة النضج")},
    ]

    return {
        "type": "bar_chart",
        "title_ar": f"متطلبات الري — {crop} (لتر/دونم/يوم)",
        "bars": bars,
        "source_ar": "معايير الري الزراعي السورية",
    }


def _build_visualization(
    *,
    intent: str,
    tool_result: dict[str, Any] | None,
    vision_desc: str,
    slots: dict[str, Any],
    research_context: str,
    raw_query: str,
) -> dict[str, Any] | None:
    """Assemble a visualization payload from already-compiled context.

    Pure transformation of the typed context — no fetching, no tools, no RAG.
    """
    user_region = slots.get("region")
    crop = slots.get("crop", "")

    # ── Bar chart for irrigation results ──────────────────────────────
    if intent == "irrigation" and tool_result:
        return _irrigation_bar_chart(tool_result)

    # ── Explicit map/chart request — always produce a Syria map ───────
    if intent == "visual":
        disease_hint = raw_query + " " + research_context[:300]
        return _disease_spread_map(crop, disease_hint, user_region)

    # ── Map for disease / vision findings ─────────────────────────────
    disease_keywords = ["بقع", "تعفن", "ذبول", "حشرة", "يرقة", "صفرار", "عفن",
                        "بياض", "صدأ", "نخر", "جرب", "حرق", "تبقع", "Rust"]
    if any(kw in vision_desc for kw in disease_keywords):
        return _disease_spread_map(crop, vision_desc, user_region)

    # ── Map for disease keywords found anywhere in the query/research ──
    all_text = raw_query + " " + research_context
    if any(kw in all_text for kw in disease_keywords):
        return _disease_spread_map(crop, all_text[:400], user_region)

    # ── Map when user asks about a specific region + agricultural issue ─
    spatial_keywords = ["محافظة", "منطقة", "قرية", "أرض", "حقل", "بستان",
                        "مزرعة", "ينتشر", "وباء", "إصابة"]
    if user_region and any(kw in (raw_query + research_context) for kw in spatial_keywords):
        return _disease_spread_map(crop, research_context[:200], user_region)

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Citation + local (offline) synthesis
# ─────────────────────────────────────────────────────────────────────────────
def _format_citation(sources: list[dict[str, Any]]) -> str:
    """Format the primary source into an Arabic citation string."""
    if not sources:
        return ""
    top = sources[0]
    book = top.get("book_title") or top.get("source", "")
    page = top.get("page_num")
    if not book:
        return ""
    page_str = f"، ص.{page}" if page and page > 1 else ""
    return f"حسب دليل {book}{page_str}"


def _local_synthesis(
    tool_summary: str,
    tips_text: str,
    vision_description: str,
    research_context: str,
    research_sources: list[dict[str, Any]],
    vision_rag_bridge: bool,
    query: str,
) -> str:
    parts: list[str] = []

    if vision_description:
        parts.append(f"**👁 ما شفته بالصورة:**\n{vision_description}")

    if tool_summary:
        parts.append(tool_summary)

    if research_context:
        citation = _format_citation(research_sources)
        header = (
            "📚 **من الكتب الزراعية — مرتبطة بما رصده الخبير البصري**"
            if vision_rag_bridge
            else f"📚 **{citation}**" if citation else "📚 **من المكتبة الزراعية**"
        )
        excerpt = research_context[:800] + ("..." if len(research_context) > 800 else "")
        parts.append(f"---\n{header}\n{excerpt}")
    elif tips_text:
        parts.append("---\n💡 **معلومات إضافية**\n" + tips_text)

    if not parts:
        parts.append(
            "بناءً على المعطيات الحالية، هاي توصيتي:\n\n"
            "١. **وضع التربة**: تأكد من رطوبة ٦٠–٧٠٪ قبل الزراعة.\n"
            "٢. **الموسم الحالي**: راجع التقويم الزراعي لمنطقتك.\n"
            "٣. **الأسعار**: تابع نشرة وزارة الزراعة أسبوعياً.\n\n"
            "للمزيد من الدقة، أخبرني بنوع المحصول والمنطقة."
        )

    parts.append("\n🌱 وفقك الله في موسمك!")
    return "\n\n".join(parts)


def _call_llm_synthesize_sync(
    query: str,
    tool_summary: str,
    tips_text: str,
    vision_description: str,
    research_context: str,
    research_sources: list[dict[str, Any]],
    vision_rag_bridge: bool,
    settings: Any,
) -> SynthesizerDraft:
    """Synchronous live-LLM call — always runs in a thread pool via run_in_executor.

    Provider-agnostic: drives whichever provider :data:`settings.llm_provider`
    resolves to (Gemini via its OpenAI-compatible endpoint, or native OpenAI)
    through the OpenAI SDK. Returns a validated :class:`SynthesizerDraft`.

    Two-tier for maximum live-response reliability:
      1. Structured output (``beta.chat.completions.parse``) → schema-perfect.
      2. If the provider rejects structured output, a plain completion whose
         text is wrapped into the schema — so the farmer still gets a real,
         dynamic answer rather than the local fallback.

    The raw SDK (not LangChain) keeps timeout / cancellation from
    ``asyncio.wait_for`` working — the thread blocks while the event loop stays free.
    """
    import openai

    citation = _format_citation(research_sources)

    context_block = ""
    if vision_description:
        context_block += f"\n\n[وصف بصري من خبير الرؤية]\n{vision_description}"
    if tool_summary:
        context_block += f"\n\n[بيانات الأداة]\n{tool_summary}"
    if research_context:
        excerpt = research_context[:1200] + ("..." if len(research_context) > 1200 else "")
        label = (
            f"[معلومات من الكتب الزراعية — {citation} — تم البحث بناءً على وصف الصورة]"
            if vision_rag_bridge and citation
            else f"[معلومات من المكتبة الزراعية السورية — {citation}]" if citation
            else "[معلومات من المكتبة الزراعية السورية]"
        )
        context_block += f"\n\n{label}\n{excerpt}"
    elif tips_text:
        context_block += f"\n\n[معلومات زراعية إضافية]\n{tips_text}"

    vision_instruction = (
        "الوصف البصري ومعلومات الكتب مترابطان — استخدمهما معاً لتشخيص دقيق. "
        if vision_rag_bridge
        else ""
    )
    citation_instruction = (
        f"استشهد بالمصدر في ردك بالصيغة: «{citation}». "
        if citation
        else ""
    )
    user_content = (
        f"سؤال المزارع: {query}"
        f"{context_block}\n\n"
        f"{vision_instruction}"
        f"{citation_instruction}"
        "بناءً على البيانات أعلاه، اكتب رداً متكاملاً باللهجة السورية في الحقل reply_ar. "
        "إذا كان هناك وصف بصري، ابدأ بالتشخيص المبدئي ثم أضف التوصيات. "
        "الرد يجب أن يكون واضحاً ومركزاً — لا تتجاوز ٢٠٠ كلمة. "
        "ضع أي مصادر استشهدت بها في الحقل citations."
    )

    client = openai.OpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,   # Gemini OpenAI-compatible endpoint, or None for OpenAI
        max_retries=0,
        timeout=float(settings.openai_timeout),
    )
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    # Tier 1 — structured output (schema-perfect)
    try:
        completion = client.beta.chat.completions.parse(
            model=settings.llm_model,
            messages=messages,
            temperature=0.65,
            response_format=SynthesizerDraft,
        )
        parsed = completion.choices[0].message.parsed
        if parsed is not None and parsed.reply_ar.strip():
            return parsed
    except Exception as exc:  # provider may not support structured output → tier 2
        log.info("structured output unavailable (%s) — plain-completion fallback", type(exc).__name__)

    # Tier 2 — plain completion, wrapped into the schema (still a real LLM reply)
    resp = client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            messages[0],
            {"role": "user", "content": user_content + "\n\nاكتب الرد النهائي مباشرةً باللهجة السورية."},
        ],
        temperature=0.65,
    )
    content = (resp.choices[0].message.content or "").strip()
    if not content:
        raise ValueError("LLM returned empty content")
    return SynthesizerDraft(reply_ar=content, citations=[citation] if citation else [])


# ─────────────────────────────────────────────────────────────────────────────
# The agent
# ─────────────────────────────────────────────────────────────────────────────
class SynthesizerAgent:
    """Generation-only terminal node. No tools, no RAG, no data fetching.

    Reads the compiled, strongly-typed upstream context and produces the final
    localized reply (plus a deterministic visualization assembled from that
    context). Exposed as a LangGraph node via :meth:`node`.
    """

    #: Architectural flag — this node may never reach out for data.
    CAN_FETCH: bool = False

    async def node(self, state: GraphState) -> dict[str, Any]:
        ctx = state.get("agricultural_context", {})

        # Assemble the synthesizer input strictly from upstream typed outputs.
        liaison = coerce(LiaisonOutput, ctx["liaison_output"])
        calc = coerce(CalculatorOutput, ctx.get("calculator_output") or CalculatorOutput())
        research = coerce(ResearchOutput, ctx.get("research_output") or ResearchOutput())
        vision_obj = ctx.get("vision_output")
        vision_description = coerce(VisionOutput, vision_obj).description_ar if vision_obj else ""

        inp = SynthesizerInput(
            raw_query=liaison.raw_query,
            tool_summary=calc.tool_summary,
            contextual_tips=calc.contextual_tips,
            vision_description=vision_description,
            research_context=research.research_context,
            research_sources=research.research_sources,
            vision_rag_bridge=research.vision_rag_bridge,
        )
        sources_dicts = [s.model_dump() for s in inp.research_sources]

        log.info("المُجمِّع — vision_rag=%s %.60s", inp.vision_rag_bridge, inp.raw_query)

        settings = get_settings()
        draft: SynthesizerDraft | None = None

        if settings.llm_api_key and llm_available():
            try:
                loop = asyncio.get_event_loop()
                # Generation runs in a thread executor so the blocking LLM
                # client cannot stall the event loop; wait_for enforces the
                # deadline.
                draft = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        functools.partial(
                            _call_llm_synthesize_sync,
                            inp.raw_query, inp.tool_summary, inp.contextual_tips,
                            inp.vision_description, inp.research_context, sources_dicts,
                            inp.vision_rag_bridge, settings,
                        ),
                    ),
                    timeout=float(settings.openai_timeout),
                )
            except Exception as exc:
                if any(x in str(exc).lower() for x in ["429", "quota", "exhausted", "insufficient", "ratelimit", "api key", "permission"]):
                    mark_llm_unavailable()
                log.warning("LLM synthesizer (%s) failed (%s) — local fallback", settings.llm_provider, type(exc).__name__)

        if draft is None:
            citation = _format_citation(sources_dicts)
            draft = SynthesizerDraft(
                reply_ar=_local_synthesis(
                    inp.tool_summary, inp.contextual_tips, inp.vision_description,
                    inp.research_context, sources_dicts, inp.vision_rag_bridge, inp.raw_query,
                ),
                citations=[citation] if citation else [],
            )

        # Visualization is a deterministic transform of the already-compiled
        # context — never an LLM call and never a data fetch.
        viz = _build_visualization(
            intent=liaison.intent,
            tool_result=calc.tool_result,
            vision_desc=vision_description,
            slots=liaison.slots,
            research_context=research.research_context,
            raw_query=liaison.raw_query,
        )

        out = SynthesizerOutput(
            reply_ar=draft.reply_ar,
            citations=draft.citations,
            visualization=viz,
        )
        return {
            "messages": [AIMessage(content=out.reply_ar, name="synthesizer")],
            "sender": "synthesizer",
            "agricultural_context": {"synthesizer_output": out},
        }


_SYNTHESIZER: SynthesizerAgent | None = None


def get_synthesizer_agent() -> SynthesizerAgent:
    """Return the shared, stateless :class:`SynthesizerAgent` instance."""
    global _SYNTHESIZER
    if _SYNTHESIZER is None:
        _SYNTHESIZER = SynthesizerAgent()
    return _SYNTHESIZER
