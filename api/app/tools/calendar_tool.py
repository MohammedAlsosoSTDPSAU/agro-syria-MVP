"""Planting calendar tool — sowing/harvest windows by crop and Syrian altitude zone."""

from __future__ import annotations

# altitude zones mapped to rough Syrian geography
# low: coastal / Ghouta / Hauran (0-400m)
# mid: interior plains / Hama / Homs (400-900m)
# high: mountains / Qalamoun / Anti-Lebanon (900m+)

_CALENDAR: dict[str, dict] = {
    "قمح": {
        "low":  {"sow": "نوفمبر–ديسمبر", "harvest": "مايو–يونيو",   "notes": "صنف القمح الساحلي يتحمل الرطوبة جيداً"},
        "mid":  {"sow": "أكتوبر–نوفمبر", "harvest": "مايو–يونيو",   "notes": "أفضل أصناف للسهول: شام ٦ وشام ٨"},
        "high": {"sow": "أكتوبر",         "harvest": "يونيو–يوليو",  "notes": "تأخر الزراعة أفضل في المناطق الجبلية البادرة"},
    },
    "شعير": {
        "low":  {"sow": "نوفمبر–ديسمبر", "harvest": "أبريل–مايو",   "notes": "يتحمل ملوحة التربة أفضل من القمح"},
        "mid":  {"sow": "أكتوبر–نوفمبر", "harvest": "أبريل–مايو",   "notes": "محصول قحط ممتاز للسهول شبه الجافة"},
        "high": {"sow": "أكتوبر",         "harvest": "مايو–يونيو",   "notes": ""},
    },
    "ذرة": {
        "low":  {"sow": "مارس–أبريل",    "harvest": "أغسطس–سبتمبر", "notes": "يحتاج ري منتظم في الصيف"},
        "mid":  {"sow": "أبريل–مايو",    "harvest": "سبتمبر",        "notes": "احرص على الري في طور الإزهار"},
        "high": {"sow": "مايو",           "harvest": "سبتمبر–أكتوبر","notes": "التأخر بالزراعة يُعرّضها للصقيع"},
    },
    "طماطم": {
        "low":  {"sow": "فبراير–مارس (مشتل)", "harvest": "يونيو–أكتوبر",  "notes": "زراعة مشتل ثم شتل في أبريل"},
        "mid":  {"sow": "مارس–أبريل (مشتل)", "harvest": "يوليو–أكتوبر",  "notes": "صنف بلدي أو هجين حسب السوق"},
        "high": {"sow": "أبريل (مشتل)",       "harvest": "أغسطس–أكتوبر", "notes": "البيوت البلاستيكية تمدد الموسم"},
    },
    "خيار": {
        "low":  {"sow": "فبراير–مارس",    "harvest": "مايو–يوليو",    "notes": ""},
        "mid":  {"sow": "مارس–أبريل",     "harvest": "يونيو–أغسطس",  "notes": ""},
        "high": {"sow": "أبريل–مايو",     "harvest": "يوليو–سبتمبر", "notes": ""},
    },
    "زيتون": {
        "low":  {"sow": "أكتوبر–نوفمبر (شتلات)", "harvest": "أكتوبر–ديسمبر", "notes": "أشجار معمّرة — الغرس الشتوي أفضل"},
        "mid":  {"sow": "أكتوبر–نوفمبر (شتلات)", "harvest": "أكتوبر–نوفمبر", "notes": "صنف الدير الأنسب للمناطق الداخلية"},
        "high": {"sow": "أكتوبر (شتلات)",         "harvest": "نوفمبر",         "notes": "الصقيع يُتلف الثمار — اختر أصناف متحملة"},
    },
    "بطاطا": {
        "low":  {"sow": "فبراير–مارس",    "harvest": "يونيو–يوليو",   "notes": "دورة ثانية ممكنة سبتمبر–نوفمبر"},
        "mid":  {"sow": "مارس–أبريل",     "harvest": "يوليو–أغسطس",  "notes": ""},
        "high": {"sow": "أبريل–مايو",     "harvest": "أغسطس–سبتمبر", "notes": "أفضل نوعية في المرتفعات"},
    },
    "عنب": {
        "low":  {"sow": "يناير–فبراير (قصبات)", "harvest": "يوليو–أغسطس",    "notes": ""},
        "mid":  {"sow": "فبراير (قصبات)",        "harvest": "أغسطس–سبتمبر",  "notes": ""},
        "high": {"sow": "مارس (قصبات)",          "harvest": "سبتمبر–أكتوبر", "notes": "عنب جبلي عالي الجودة"},
    },
}

_DEFAULT_CROP = {
    "low":  {"sow": "راجع خبير محلي",  "harvest": "حسب الصنف", "notes": ""},
    "mid":  {"sow": "راجع خبير محلي",  "harvest": "حسب الصنف", "notes": ""},
    "high": {"sow": "راجع خبير محلي",  "harvest": "حسب الصنف", "notes": ""},
}


def _altitude_zone(altitude_m: int) -> str:
    if altitude_m < 400:
        return "low"
    if altitude_m < 900:
        return "mid"
    return "high"


_ZONE_LABELS = {"low": "منخفضة (ساحل/غوطة)", "mid": "متوسطة (سهول داخلية)", "high": "جبلية"}


def get_planting_schedule(crop: str, location_altitude: int) -> dict:
    """Returns sowing and harvest windows for *crop* at *location_altitude* metres."""
    zone = _altitude_zone(location_altitude)
    crop_data = _CALENDAR.get(crop, _DEFAULT_CROP)
    window = crop_data[zone]

    return {
        "crop": crop,
        "altitude_m": location_altitude,
        "altitude_zone": _ZONE_LABELS[zone],
        "sowing_window": window["sow"],
        "harvest_window": window["harvest"],
        "agronomic_notes": window["notes"],
    }
