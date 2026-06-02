"""Irrigation calculation tool — estimates water needs for Syrian crops."""

from __future__ import annotations

# Litres per dunum per day at peak demand, by crop
_BASE_LITRES: dict[str, float] = {
    "قمح":    420,
    "شعير":   380,
    "ذرة":    680,
    "طماطم":  850,
    "خيار":   800,
    "بطاطا":  700,
    "زيتون":  300,
    "عنب":    350,
    "تفاح":   450,
    "بصل":    600,
    "ثوم":    500,
    "فول":    520,
    "عدس":    360,
    "قطن":    920,
}

# Growth-stage multipliers: young (0-30d), mid (31-90d), late (91+d)
def _stage_factor(age_days: int) -> float:
    if age_days <= 30:
        return 0.55
    if age_days <= 90:
        return 1.0
    return 0.75


def calculate_irrigation(crop: str, area_dunums: float, crop_age_days: int) -> dict:
    """
    Returns daily and weekly water estimates for *crop* grown on *area_dunums*
    dunums at *crop_age_days* days after sowing.

    All values are in litres.
    """
    base = _BASE_LITRES.get(crop, 600)          # default 600 L/dunum/day
    factor = _stage_factor(crop_age_days)
    daily_per_dunum = base * factor
    daily_total = daily_per_dunum * area_dunums
    weekly_total = daily_total * 7

    # Irrigation sessions: recommended 2×/week in mid-stage, 1×/week otherwise
    sessions_per_week = 2 if 31 <= crop_age_days <= 90 else 1
    per_session = weekly_total / sessions_per_week

    stage_label = (
        "مرحلة النمو المبكر" if crop_age_days <= 30
        else "مرحلة النمو الرئيسية" if crop_age_days <= 90
        else "مرحلة النضج"
    )

    return {
        "crop": crop,
        "area_dunums": area_dunums,
        "crop_age_days": crop_age_days,
        "stage": stage_label,
        "daily_litres_total": round(daily_total),
        "weekly_litres_total": round(weekly_total),
        "sessions_per_week": sessions_per_week,
        "litres_per_session": round(per_session),
    }
