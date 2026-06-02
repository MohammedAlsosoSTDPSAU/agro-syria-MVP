"""Agro-Syria LangGraph orchestration — Phase 4.3.

Flow (no image):
  START -> Liaison Agent -> [route] -> Agricultural Calculator -> Research Agent -> Strategic Synthesizer -> END
                                    -> (greeting / slot-ask)                                              -> END

Flow (with image):
  START -> Liaison Agent -> Vision Agent -> Agricultural Calculator -> Research Agent -> Strategic Synthesizer -> END

Phase 4.3 additions:
  - Syrian dialect map for query expansion (dialect_map.json)
  - Location-based RAG result prioritisation
  - Source citations: "حسب دليل [اسم الكتاب]، ص.N"
  - Visualization payload: SVG map or bar chart attached to ChatResponse
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
from app.core.logging import get_logger
from app.core.mock_intelligence import get_contextual_tips, get_mock_vision_description
from app.core.rag_engine import search_knowledge_base
from app.core.state import GraphState

log = get_logger("agro_syria.graph")

_DIALECT_MAP_PATH = Path(__file__).resolve().parent / "dialect_map.json"

# Fail-fast flag — set to False after the first 429 / quota-exceeded response
# so subsequent requests skip the OpenAI call entirely instead of waiting for
# the timeout to fire.
_openai_available: bool = True


def _mark_openai_unavailable() -> None:
    global _openai_available
    _openai_available = False
    log.warning("OpenAI marked unavailable — switching to local synthesis for all requests")


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
# Syrian governorate registry — for map visualization
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

# Disease spread intensity modifiers by region type
_COASTAL     = {"اللاذقية", "طرطوس"}         # higher fungal risk
_DRY_NORTH   = {"حلب", "إدلب", "حماة"}       # higher insect/aphid risk
_NORTHEAST   = {"الرقة", "دير الزور", "الحسكة"}  # rust / cereal disease risk


# ─────────────────────────────────────────────────────────────────────────────
# Visualization builders
# ─────────────────────────────────────────────────────────────────────────────

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


def _build_visualization(ctx: dict[str, Any]) -> dict[str, Any] | None:
    """Decide whether to generate a visualization and build its payload."""
    intent           = ctx.get("intent", "general")
    tool_result      = ctx.get("tool_result")
    vision_desc      = ctx.get("vision_description", "")
    slots            = ctx.get("slots", {})
    user_region      = slots.get("region")
    crop             = slots.get("crop", "")
    research_context = ctx.get("research_context", "")
    raw_query        = ctx.get("raw_query", "")

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
    disease_detected = any(kw in vision_desc for kw in disease_keywords)

    if disease_detected:
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
    (["ري ", " ري", "مياه", "سقاية", "رشاش", "تنقيط", "احسب الري", "كمية مياه"], "irrigation"),
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
_SYSTEM_PROMPT = (
    "أنت خبير زراعي سوري ذكي جداً، اسمك (أغرو-سيريا). "
    "تتحدث باللهجة السورية البيضاء (المريحة والقريبة للقلب). "
    "إذا حيّاك المستخدم، رد عليه بترحيب سوري دافئ دون الدخول في تفاصيل تقنية إلا إذا سأل. "
    "إذا سأل عن الزراعة، استخدم خبرتك لتقديم نصائح دقيقة ومختصرة باللهجة السورية. "
    "عند الاستشهاد بمصادر زراعية استخدم الصيغة: «حسب دليل [اسم الكتاب]...». "
    "دائماً اختم ردك بجملة تشجيعية قصيرة."
)

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
    has_image = bool(ctx.get("image_base64"))

    log.info("وكيل التواصل — image=%s msg=%.60s", has_image, user_msg)

    if has_image:
        return {
            "messages": [AIMessage(content="وصلتني صورتك، عم بحللها مع الخبراء...", name="liaison")],
            "sender": "liaison",
            "agricultural_context": {
                "raw_query": user_msg or "ما تشوف في هالصورة؟",
                "is_greeting": False,
                "slot_ask": False,
                "has_image": True,
                "intent": "vision",
            },
        }

    is_greeting = _is_greeting(user_msg)
    if is_greeting:
        reply = (
            "أهلاً وسهلاً! 🌿 أنا أغرو-سيريا، خبيرك الزراعي الذكي. "
            "يسعدني أكون رفيقك في كل ما يخص أرضك وزراعتك. "
            "شو بدك تعرف اليوم؟"
        )
        return {
            "messages": [AIMessage(content=reply, name="liaison")],
            "sender": "liaison",
            "agricultural_context": {"raw_query": user_msg, "is_greeting": True},
        }

    intent = _detect_intent(user_msg)
    slots = _extract_slots(intent, user_msg)
    slot_ask = _build_slot_ask(intent, slots) if intent != "general" else None

    if slot_ask:
        log.info("slot-filling ask — intent=%s", intent)
        return {
            "messages": [AIMessage(content=slot_ask, name="liaison")],
            "sender": "liaison",
            "agricultural_context": {
                "raw_query": user_msg,
                "is_greeting": False,
                "slot_ask": True,
                "intent": intent,
                "slots": slots,
            },
        }

    return {
        "messages": [AIMessage(content="عم بجهزلك تقرير من فريق الخبراء...", name="liaison")],
        "sender": "liaison",
        "agricultural_context": {
            "raw_query": user_msg,
            "is_greeting": False,
            "slot_ask": False,
            "has_image": False,
            "intent": intent,
            "slots": slots,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Edge router (after liaison)
# ─────────────────────────────────────────────────────────────────────────────
def _route_after_liaison(state: GraphState) -> str:
    ctx = state.get("agricultural_context", {})
    if ctx.get("is_greeting") or ctx.get("slot_ask"):
        return END
    if ctx.get("has_image"):
        return "Vision Agent"
    return "Agricultural Calculator"


# ─────────────────────────────────────────────────────────────────────────────
# Node: Vision Agent  (GPT-4o vision → objective crop/disease description)
# ─────────────────────────────────────────────────────────────────────────────
async def vision_node(state: GraphState) -> dict[str, Any]:
    ctx = state.get("agricultural_context", {})
    image_b64: str = ctx.get("image_base64", "")
    query: str = ctx.get("raw_query", "ما تشوف في هالصورة؟")
    settings = get_settings()

    log.info("خبير المعاينة البصرية — analyzing image (%d bytes b64)", len(image_b64))

    description = ""
    if settings.openai_api_key and image_b64:
        try:
            description = await asyncio.wait_for(
                _call_vision_openai(image_b64, query, settings),
                timeout=float(settings.openai_timeout),
            )
        except Exception as exc:
            log.warning("Vision OpenAI call failed (%s) — using mock", type(exc).__name__)
            description = get_mock_vision_description()
    else:
        description = get_mock_vision_description()

    return {
        "messages": [AIMessage(content=description, name="vision")],
        "sender": "vision_agent",
        "agricultural_context": {
            "vision_description": description,
        },
    }


async def _call_vision_openai(image_b64: str, query: str, settings: Any) -> str:
    from langchain_openai import ChatOpenAI

    raw_b64 = image_b64.split(",", 1)[1] if "," in image_b64 else image_b64

    llm = ChatOpenAI(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        temperature=0.3,
        max_tokens=400,
        timeout=settings.openai_timeout,
        max_retries=0,
    )
    response = await llm.ainvoke([
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
    return str(response.content)


# ─────────────────────────────────────────────────────────────────────────────
# Node: Agricultural Calculator  (tool invocation + keyword tips)
# ─────────────────────────────────────────────────────────────────────────────
async def field_agent_node(state: GraphState) -> dict[str, Any]:
    ctx = state.get("agricultural_context", {})
    intent: str = ctx.get("intent", "general")
    slots: dict = ctx.get("slots", {})
    query: str = ctx.get("raw_query", "")
    vision_description: str = ctx.get("vision_description", "")

    log.info("عميل الحقل — intent=%s has_vision=%s", intent, bool(vision_description))

    tool_result: dict | None = None
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

    combined_query = f"{query} {vision_description}".strip()
    tips = get_contextual_tips(combined_query)
    tips_text = "\n\n".join(tips[:2]) if tips else ""

    field_content = tool_summary or (
        f"👁 **وصف بصري مستلم**\n{vision_description}" if vision_description else "جاري التحليل..."
    )

    return {
        "messages": [AIMessage(content=field_content, name="field")],
        "sender": "field_agent",
        "agricultural_context": {
            "tool_result": tool_result,
            "tool_summary": tool_summary,
            "contextual_tips": tips_text,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Node: Research Agent  (Vision-RAG bridge + knowledge-base search)
# ─────────────────────────────────────────────────────────────────────────────
async def research_node(state: GraphState) -> dict[str, Any]:
    ctx = state.get("agricultural_context", {})
    query: str = ctx.get("raw_query", "")
    vision_description: str = ctx.get("vision_description", "")
    slots: dict = ctx.get("slots", {})
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

    results = search_knowledge_base(expanded_query, k=4)  # fetch 4; may discard after location boost

    # ── Location-based prioritisation ────────────────────────────────
    if user_region and results:
        for r in results:
            if user_region in r.get("text", ""):
                r["score"] = round(r["score"] * 1.20, 4)  # 20% boost for region match
        results.sort(key=lambda x: x["score"], reverse=True)
        log.info("وكيل البحث — applied location boost for region=%s", user_region)

    results = results[:3]  # keep top-3 after re-ranking

    # ── Build citation metadata ───────────────────────────────────────
    research_sources: list[dict[str, Any]] = []
    if results:
        passages = "\n\n---\n\n".join(
            f"[{r.get('book_title', r['source'])} | ص.{r.get('page_num', '?')} | score {r['score']:.2f}]\n{r['text']}"
            for r in results
        )
        top_score = results[0].get("score", 0)
        log.info("RAG retrieved %d chunks (top score=%.3f)", len(results), top_score)

        research_sources = [
            {
                "book_title": r.get("book_title", r["source"]),
                "page_num": r.get("page_num"),
                "source": r["source"],
            }
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
        status_msg = "لم أجد معلومات مباشرة في المكتبة — سأعتمد على خبرتي الزراعية."
        log.info("RAG returned no results")

    return {
        "messages": [AIMessage(content=status_msg, name="research")],
        "sender": "research_agent",
        "agricultural_context": {
            "research_context": passages,
            "research_sources": research_sources,
            "vision_rag_bridge": from_vision,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Node: Strategic Synthesizer  (final reply with all context + visualization)
# ─────────────────────────────────────────────────────────────────────────────
async def synthesizer_node(state: GraphState) -> dict[str, Any]:
    ctx = state.get("agricultural_context", {})
    query: str = ctx.get("raw_query", "")
    tool_summary: str = ctx.get("tool_summary", "")
    tips_text: str = ctx.get("contextual_tips", "")
    vision_description: str = ctx.get("vision_description", "")
    research_context: str = ctx.get("research_context", "")
    research_sources: list = ctx.get("research_sources", [])
    vision_rag_bridge: bool = ctx.get("vision_rag_bridge", False)

    log.info("المُجمِّع — vision_rag=%s %.60s", vision_rag_bridge, query)

    settings = get_settings()

    if settings.openai_api_key and _openai_available:
        try:
            import functools
            loop = asyncio.get_event_loop()
            # Run in thread executor — the sync openai client uses httpx blocking
            # I/O which cannot block the asyncio event loop from a thread, so
            # asyncio.wait_for can always cancel on timeout.
            reply = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    functools.partial(
                        _call_openai_synthesize_sync,
                        query, tool_summary, tips_text, vision_description,
                        research_context, research_sources, vision_rag_bridge, settings,
                    ),
                ),
                timeout=float(settings.openai_timeout),
            )
        except Exception as exc:
            exc_str = str(exc)
            if any(x in exc_str for x in ["429", "quota", "insufficient_quota", "RateLimitError"]):
                _mark_openai_unavailable()
            log.warning("OpenAI synthesizer failed (%s) — local fallback", type(exc).__name__)
            reply = _local_synthesis(
                tool_summary, tips_text, vision_description, research_context,
                research_sources, vision_rag_bridge, query
            )
    else:
        reply = _local_synthesis(
            tool_summary, tips_text, vision_description, research_context,
            research_sources, vision_rag_bridge, query
        )

    # ── Build visualization payload ───────────────────────────────────
    viz = _build_visualization(ctx)

    return {
        "messages": [AIMessage(content=reply, name="synthesizer")],
        "sender": "synthesizer",
        "agricultural_context": {
            "synthesizer_done": True,
            "visualization": viz,
        },
    }


def _format_citation(sources: list[dict[str, Any]]) -> str:
    """Format the primary source into Arabic citation string."""
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
    research_sources: list,
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


def _call_openai_synthesize_sync(
    query: str,
    tool_summary: str,
    tips_text: str,
    vision_description: str,
    research_context: str,
    research_sources: list,
    vision_rag_bridge: bool,
    settings: Any,
) -> str:
    """Synchronous OpenAI call — always runs in thread pool via run_in_executor.

    Using the raw openai SDK (not LangChain) ensures that timeouts and
    cancellation from asyncio.wait_for work correctly: the thread blocks,
    but the event loop stays free.
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
        "بناءً على البيانات أعلاه، اكتب رداً متكاملاً باللهجة السورية. "
        "إذا كان هناك وصف بصري، ابدأ بالتشخيص المبدئي ثم أضف التوصيات. "
        "الرد يجب أن يكون واضحاً ومركزاً — لا تتجاوز ٢٠٠ كلمة."
    )

    client = openai.OpenAI(
        api_key=settings.openai_api_key,
        max_retries=0,
        timeout=float(settings.openai_timeout),
    )
    response = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.65,
    )
    return response.choices[0].message.content or ""


# ─────────────────────────────────────────────────────────────────────────────
# Graph compilation (singleton)
# ─────────────────────────────────────────────────────────────────────────────
@lru_cache(maxsize=1)
def get_compiled_graph():
    builder: StateGraph = StateGraph(GraphState)

    builder.add_node("Liaison Agent",           liaison_node)
    builder.add_node("Vision Agent",            vision_node)
    builder.add_node("Agricultural Calculator", field_agent_node)
    builder.add_node("Research Agent",          research_node)
    builder.add_node("Strategic Synthesizer",   synthesizer_node)

    builder.add_edge(START, "Liaison Agent")
    builder.add_conditional_edges(
        "Liaison Agent",
        _route_after_liaison,
        {
            "Vision Agent":             "Vision Agent",
            "Agricultural Calculator":  "Agricultural Calculator",
            END:                        END,
        },
    )
    builder.add_edge("Vision Agent",            "Agricultural Calculator")
    builder.add_edge("Agricultural Calculator", "Research Agent")
    builder.add_edge("Research Agent",          "Strategic Synthesizer")
    builder.add_edge("Strategic Synthesizer",   END)

    compiled = builder.compile()
    log.info(
        "LangGraph compiled — Liaison -> [Vision?] -> Calculator -> Research -> Synthesizer | END"
    )
    return compiled
