"""Syrian agricultural market prices tool — mock data with realistic regional variation."""

from __future__ import annotations

import random

# Base prices in Syrian Pounds per kg (approximate 2025 figures)
_BASE_PRICES: dict[str, dict] = {
    "قمح":   {"price": 4_200, "trend": "+8%",  "note": "الطلب مرتفع بسبب موسم الحصاد المتأخر"},
    "شعير":  {"price": 3_800, "trend": "+5%",  "note": "أسعار مستقرة مع توقع ارتفاع طفيف"},
    "ذرة":   {"price": 5_500, "trend": "+12%", "note": "نقص في المخزون المحلي يرفع الأسعار"},
    "طماطم": {"price": 2_100, "trend": "-3%",  "note": "موسم وفير يضغط على الأسعار"},
    "خيار":  {"price": 1_800, "trend": "+2%",  "note": "أسعار شبه ثابتة هذا الأسبوع"},
    "بطاطا": {"price": 3_200, "trend": "+15%", "note": "ارتفاع ملحوظ بسبب انخفاض الإنتاج"},
    "زيتون": {"price": 9_500, "trend": "+6%",  "note": "موسم ممتاز يُتوقع أن يخفف الأسعار"},
    "عنب":   {"price": 4_800, "trend": "+4%",  "note": "الطلب المحلي والتصدير يدعمان السعر"},
    "تفاح":  {"price": 6_200, "trend": "+9%",  "note": "إنتاج الجبل الجيد يُنعش العرض"},
    "بصل":   {"price": 2_500, "trend": "-5%",  "note": "وفرة في السوق تُخفض الأسعار"},
    "ثوم":   {"price": 12_000, "trend": "+18%", "note": "شُح المعروض المحلي يرفع الأسعار بشكل حاد"},
    "فول":   {"price": 5_800, "trend": "+3%",  "note": "ثابت نسبياً مع طلب مستمر"},
    "عدس":   {"price": 6_500, "trend": "+7%",  "note": "الطلب الرمضاني يؤثر على السعر موسمياً"},
    "قطن":   {"price": 8_800, "trend": "+11%", "note": "تحسن تصدير الألياف يدعم الأسعار"},
}

# Regional price multipliers
_REGION_FACTORS: dict[str, float] = {
    "دمشق":    1.15,
    "حلب":     1.10,
    "حمص":     1.05,
    "حماة":    1.00,
    "اللاذقية": 1.12,
    "درعا":    0.92,
    "دير الزور": 0.88,
    "الرقة":   0.85,
    "إدلب":    0.90,
    "السويداء": 0.95,
    "القنيطرة": 0.93,
}


def get_syrian_market_prices(crop: str, region: str) -> dict:
    """Returns current and forecast market prices for *crop* in *region*."""
    base = _BASE_PRICES.get(crop)
    if base is None:
        return {
            "crop": crop,
            "region": region,
            "error": f"لا توجد بيانات سعرية للمحصول: {crop}",
        }

    factor = _REGION_FACTORS.get(region, 1.0)
    # Small deterministic jitter so the same query returns consistent results
    jitter = 1 + (hash(crop + region) % 7 - 3) / 100  # ±3%
    current_price = round(base["price"] * factor * jitter / 50) * 50  # round to nearest 50

    return {
        "crop": crop,
        "region": region,
        "price_per_kg_syp": current_price,
        "weekly_trend": base["trend"],
        "market_note": base["note"],
        "best_sell_window": "خلال أسبوعين" if "+" in base["trend"] else "الآن أو قريباً",
    }
