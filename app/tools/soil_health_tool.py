"""Soil health analysis tool — fertiliser and amendment recommendations."""

from __future__ import annotations

# Optimal pH ranges per crop family
_PH_RANGES: dict[str, tuple[float, float]] = {
    "حبوب":    (6.0, 7.0),
    "خضروات":  (5.8, 7.0),
    "اشجار":   (6.0, 7.5),
    "بقوليات": (6.0, 7.0),
}

# Soil-type fertility notes
_SOIL_NOTES: dict[str, str] = {
    "طينية":   "الترب الطينية غنية بالمغذيات لكنها تحتاج تصريفاً جيداً لتجنب تغريق الجذور.",
    "رملية":   "الترب الرملية سريعة الصرف وتحتاج إضافة مواد عضوية وتسميداً أكثر تكراراً.",
    "طميية":   "الترب الطميية مثالية — توازن ممتاز بين الصرف والخصوبة.",
    "صخرية":  "الترب الصخرية تحتاج تعديلاً عميقاً بالكومبوست والتسوية قبل الزراعة.",
    "جيرية":   "الترب الجيرية قلوية — أضف كبريت أو مواد حمضية لتصحيح الـ pH.",
}


def analyze_soil_needs(ph: float, soil_type: str, last_fertilized_days: int) -> dict:
    """
    Returns a soil health assessment and fertilisation recommendations.
    """
    # Determine pH status relative to a general crop optimum of 6.2–7.0
    if ph < 5.5:
        ph_status = "حمضية جداً"
        ph_action = "أضف جيراً زراعياً (كالسيوم كربونات) — نحو ٢٠٠ كغ/دونم لرفع الـ pH وحدة واحدة."
    elif ph < 6.2:
        ph_status = "حمضية"
        ph_action = "أضف كمية بسيطة من الجير الزراعي — ١٠٠ كغ/دونم تكفي."
    elif ph <= 7.2:
        ph_status = "مثالية"
        ph_action = "الـ pH ممتاز، لا يحتاج تعديل."
    elif ph <= 7.8:
        ph_status = "قلوية"
        ph_action = "أضف كبريتاً زراعياً — ٥٠ كغ/دونم يخفض الـ pH بمقدار ٠.٥ تقريباً."
    else:
        ph_status = "قلوية جداً"
        ph_action = "الـ pH عالٍ جداً — استخدم كبريت زراعي (١٠٠ كغ/دونم) وأضف كومبوست غني."

    soil_note = _SOIL_NOTES.get(soil_type, "نوع التربة غير معروف — يُنصح بتحليل مخبري.")

    # Fertilisation urgency
    if last_fertilized_days > 90:
        fert_urgency = "عاجل"
        fert_note = "مضى أكثر من ٣ أشهر على آخر تسميدة — التربة محتاجة NPK كامل."
    elif last_fertilized_days > 45:
        fert_urgency = "قريباً"
        fert_note = "يُنصح بجرعة نيتروجين تكميلية (يوريا ٢٥ كغ/دونم) خلال أسبوعين."
    else:
        fert_urgency = "لا يوجد"
        fert_note = "التسميد الأخير كافٍ حتى الآن."

    return {
        "ph": ph,
        "ph_status": ph_status,
        "ph_action": ph_action,
        "soil_type": soil_type,
        "soil_note": soil_note,
        "last_fertilized_days": last_fertilized_days,
        "fertilisation_urgency": fert_urgency,
        "fertilisation_note": fert_note,
    }
