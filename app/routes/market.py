"""
GET /api/market/crops        — full crop catalogue (36 crops, optional ?category= ?region=)
GET /api/market/regions      — governorate production summaries (14 provinces)
GET /api/market/summary      — crops + regions in one call (used by dashboard)
GET /api/market/prices/{key} — 6-month price history for a single crop
"""

from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schema.market import (
    CropData,
    MarketCropsResponse,
    MarketRegionsResponse,
    MarketSummaryResponse,
    PriceHistoryPoint,
    RegionSummary,
)

router = APIRouter(prefix="/api/market", tags=["market"])

# ── Price history helper ──────────────────────────────────────────────
_MONTHS_AR = ["نوفمبر", "ديسمبر", "يناير", "فبراير", "مارس", "أبريل"]


def _hist(base: float, step: float) -> list[PriceHistoryPoint]:
    """Generate 6-month price history with a linear trend + small noise."""
    import random

    rng = random.Random(int(base))  # deterministic per price so response is stable
    return [
        PriceHistoryPoint(
            month_ar=_MONTHS_AR[i],
            price=round(base + step * i + rng.uniform(-base * 0.015, base * 0.015), 1),
        )
        for i in range(6)
    ]


# ── Master crop catalogue (36 crops) ─────────────────────────────────
def _build_crops() -> list[CropData]:
    raw: list[dict] = [
        # ── STRATEGIC (8) ──────────────────────────────────────────────
        dict(key="wheat",       name_ar="قمح",           name_en="Wheat",        category="strategic",
             price_syp=420,   price_prev=405, top_gov_ar="الحسكة",   yield_ton_ha=2.8,  area_ha=1420, production_ton=3150, season="مايو–يونيو"),
        dict(key="barley",      name_ar="شعير",           name_en="Barley",       category="strategic",
             price_syp=328,   price_prev=312, top_gov_ar="الحسكة",   yield_ton_ha=2.2,  area_ha=580,  production_ton=1280, season="أبريل–مايو"),
        dict(key="cotton",      name_ar="قطن",            name_en="Cotton",       category="strategic",
             price_syp=1850,  price_prev=1820,top_gov_ar="الحسكة",   yield_ton_ha=2.4,  area_ha=110,  production_ton=265,  season="أكتوبر–نوفمبر"),
        dict(key="lentils",     name_ar="عدس",            name_en="Lentils",      category="strategic",
             price_syp=950,   price_prev=910, top_gov_ar="الحسكة",   yield_ton_ha=1.5,  area_ha=95,   production_ton=143,  season="مايو–يونيو"),
        dict(key="sugar_beet",  name_ar="شمندر سكري",     name_en="Sugar Beet",   category="strategic",
             price_syp=118,   price_prev=110, top_gov_ar="الحسكة",   yield_ton_ha=25.0, area_ha=42,   production_ton=1050, season="أكتوبر–ديسمبر"),
        dict(key="chickpeas",   name_ar="حمص حب",         name_en="Chickpeas",    category="strategic",
             price_syp=1100,  price_prev=1070,top_gov_ar="حلب",      yield_ton_ha=1.2,  area_ha=72,   production_ton=86,   season="مايو–يونيو"),
        dict(key="peas",        name_ar="بازلاء",          name_en="Peas",         category="strategic",
             price_syp=780,   price_prev=755, top_gov_ar="حلب",      yield_ton_ha=1.8,  area_ha=38,   production_ton=68,   season="أبريل–مايو"),
        dict(key="tobacco",     name_ar="تبغ",             name_en="Tobacco",      category="strategic",
             price_syp=2800,  price_prev=2750,top_gov_ar="اللاذقية", yield_ton_ha=1.1,  area_ha=18,   production_ton=20,   season="أغسطس–سبتمبر"),
        # ── VEGETABLES (10) ────────────────────────────────────────────
        dict(key="tomato",      name_ar="طماطم",           name_en="Tomatoes",     category="vegetables",
             price_syp=540,   price_prev=610, top_gov_ar="درعا",     yield_ton_ha=28.0, area_ha=75,   production_ton=2100, season="يونيو–سبتمبر"),
        dict(key="potato",      name_ar="بطاطا",           name_en="Potatoes",     category="vegetables",
             price_syp=380,   price_prev=360, top_gov_ar="ريف دمشق",yield_ton_ha=22.0, area_ha=45,   production_ton=990,  season="يونيو–أغسطس"),
        dict(key="onion",       name_ar="بصل",             name_en="Onion",        category="vegetables",
             price_syp=290,   price_prev=275, top_gov_ar="حمص",      yield_ton_ha=18.0, area_ha=28,   production_ton=504,  season="يونيو–يوليو"),
        dict(key="garlic",      name_ar="ثوم",             name_en="Garlic",       category="vegetables",
             price_syp=1650,  price_prev=1590,top_gov_ar="حمص",      yield_ton_ha=6.5,  area_ha=5,    production_ton=32,   season="مايو–يونيو"),
        dict(key="cucumber",    name_ar="خيار",            name_en="Cucumber",     category="vegetables",
             price_syp=320,   price_prev=295, top_gov_ar="حماة",     yield_ton_ha=24.0, area_ha=18,   production_ton=432,  season="مايو–أكتوبر"),
        dict(key="pepper",      name_ar="فليفلة",          name_en="Bell Pepper",  category="vegetables",
             price_syp=480,   price_prev=445, top_gov_ar="حماة",     yield_ton_ha=16.0, area_ha=12,   production_ton=192,  season="يونيو–أكتوبر"),
        dict(key="eggplant",    name_ar="باذنجان",          name_en="Eggplant",     category="vegetables",
             price_syp=360,   price_prev=340, top_gov_ar="درعا",     yield_ton_ha=20.0, area_ha=14,   production_ton=280,  season="يونيو–أكتوبر"),
        dict(key="zucchini",    name_ar="كوسا",            name_en="Zucchini",     category="vegetables",
             price_syp=310,   price_prev=295, top_gov_ar="ريف دمشق",yield_ton_ha=18.0, area_ha=9,    production_ton=162,  season="مايو–أكتوبر"),
        dict(key="carrot",      name_ar="جزر",             name_en="Carrot",       category="vegetables",
             price_syp=260,   price_prev=248, top_gov_ar="حمص",      yield_ton_ha=22.0, area_ha=7,    production_ton=154,  season="نوفمبر–مارس"),
        dict(key="cabbage",     name_ar="ملفوف",           name_en="Cabbage",      category="vegetables",
             price_syp=200,   price_prev=192, top_gov_ar="ريف دمشق",yield_ton_ha=25.0, area_ha=6,    production_ton=150,  season="نوفمبر–أبريل"),
        dict(key="sweet_potato",name_ar="بطاطا حلوة",      name_en="Sweet Potato", category="vegetables",
             price_syp=450,   price_prev=430, top_gov_ar="درعا",     yield_ton_ha=15.0, area_ha=4,    production_ton=60,   season="سبتمبر–أكتوبر"),
        # ── FRUITS (11) ────────────────────────────────────────────────
        dict(key="olive",       name_ar="زيتون",           name_en="Olive",        category="fruits",
             price_syp=1200,  price_prev=1150,top_gov_ar="إدلب",     yield_ton_ha=3.2,  area_ha=420,  production_ton=1344, season="أكتوبر–ديسمبر"),
        dict(key="olive_oil",   name_ar="زيت الزيتون",    name_en="Olive Oil",    category="fruits",
             price_syp=9600,  price_prev=9300,top_gov_ar="إدلب",     yield_ton_ha=0.6,  area_ha=420,  production_ton=250,  season="نوفمبر–يناير"),
        dict(key="grapes",      name_ar="عنب",             name_en="Grapes",       category="fruits",
             price_syp=760,   price_prev=690, top_gov_ar="السويداء", yield_ton_ha=6.5,  area_ha=52,   production_ton=338,  season="أغسطس–أكتوبر"),
        dict(key="citrus",      name_ar="حمضيات",          name_en="Citrus",       category="fruits",
             price_syp=350,   price_prev=400, top_gov_ar="طرطوس",    yield_ton_ha=9.0,  area_ha=28,   production_ton=252,  season="نوفمبر–مارس"),
        dict(key="pistachios",  name_ar="فستق حلبي",       name_en="Pistachios",   category="fruits",
             price_syp=14800, price_prev=14100,top_gov_ar="إدلب",    yield_ton_ha=1.8,  area_ha=35,   production_ton=63,   season="سبتمبر–أكتوبر"),
        dict(key="apple",       name_ar="تفاح",            name_en="Apple",        category="fruits",
             price_syp=580,   price_prev=550, top_gov_ar="السويداء", yield_ton_ha=12.0, area_ha=20,   production_ton=240,  season="أغسطس–أكتوبر"),
        dict(key="apricot",     name_ar="مشمش",            name_en="Apricot",      category="fruits",
             price_syp=680,   price_prev=640, top_gov_ar="حلب",      yield_ton_ha=10.0, area_ha=15,   production_ton=150,  season="مايو–يوليو"),
        dict(key="cherry",      name_ar="كرز",             name_en="Cherry",       category="fruits",
             price_syp=1800,  price_prev=1720,top_gov_ar="السويداء", yield_ton_ha=8.0,  area_ha=8,    production_ton=64,   season="مايو–يونيو"),
        dict(key="fig",         name_ar="تين",             name_en="Fig",          category="fruits",
             price_syp=820,   price_prev=790, top_gov_ar="اللاذقية", yield_ton_ha=7.0,  area_ha=12,   production_ton=84,   season="أغسطس–أكتوبر"),
        dict(key="pomegranate", name_ar="رمان",            name_en="Pomegranate",  category="fruits",
             price_syp=750,   price_prev=710, top_gov_ar="حماة",     yield_ton_ha=9.0,  area_ha=10,   production_ton=90,   season="سبتمبر–نوفمبر"),
        dict(key="almond",      name_ar="لوز",             name_en="Almond",       category="fruits",
             price_syp=4200,  price_prev=4050,top_gov_ar="حلب",      yield_ton_ha=1.5,  area_ha=22,   production_ton=33,   season="يونيو–أغسطس"),
        # ── GRAINS (7) ────────────────────────────────────────────────
        dict(key="corn",        name_ar="ذرة شامية",        name_en="Corn",         category="grains",
             price_syp=380,   price_prev=365, top_gov_ar="الحسكة",   yield_ton_ha=5.5,  area_ha=30,   production_ton=165,  season="سبتمبر–أكتوبر"),
        dict(key="sesame",      name_ar="سمسم",            name_en="Sesame",       category="grains",
             price_syp=2200,  price_prev=2150,top_gov_ar="دير الزور",yield_ton_ha=0.9,  area_ha=25,   production_ton=22,   season="أغسطس–سبتمبر"),
        dict(key="sunflower",   name_ar="عباد الشمس",      name_en="Sunflower",    category="grains",
             price_syp=680,   price_prev=660, top_gov_ar="الحسكة",   yield_ton_ha=1.6,  area_ha=18,   production_ton=29,   season="سبتمبر"),
        dict(key="flax",        name_ar="كتان",            name_en="Flax",         category="grains",
             price_syp=920,   price_prev=900, top_gov_ar="حلب",      yield_ton_ha=0.8,  area_ha=8,    production_ton=6,    season="مايو–يونيو"),
        dict(key="rice",        name_ar="أرز",             name_en="Rice",         category="grains",
             price_syp=1450,  price_prev=1420,top_gov_ar="دير الزور",yield_ton_ha=4.2,  area_ha=10,   production_ton=42,   season="أكتوبر"),
        dict(key="sorghum",     name_ar="ذرة بيضاء",       name_en="Sorghum",      category="grains",
             price_syp=310,   price_prev=298, top_gov_ar="الرقة",    yield_ton_ha=2.8,  area_ha=14,   production_ton=39,   season="سبتمبر–أكتوبر"),
        dict(key="anise",       name_ar="ينسون",           name_en="Anise",        category="grains",
             price_syp=3800,  price_prev=3700,top_gov_ar="حلب",      yield_ton_ha=0.7,  area_ha=5,    production_ton=4,    season="يونيو–يوليو"),
    ]
    result = []
    for r in raw:
        prev = float(r["price_prev"])
        cur  = float(r["price_syp"])
        step = (cur - prev) / 5
        result.append(
            CropData(
                **{k: v for k, v in r.items()},
                change_pct=round((cur - prev) / prev * 100, 2),
                unit="ل.س/كغ",
                history=_hist(prev, step),
            )
        )
    return result


# ── Master region catalogue (14 governorates) ─────────────────────────
_ALL_REGIONS: list[RegionSummary] = [
    RegionSummary(gov_ar="الحسكة",   gov_en="Al-Hasakah",    lat=36.50, lng=40.74, intensity=0.85, area_rank=1,  top_crop_ar="قمح",       production_score=92),
    RegionSummary(gov_ar="حلب",      gov_en="Aleppo",         lat=36.20, lng=37.16, intensity=0.75, area_rank=2,  top_crop_ar="قمح",       production_score=82),
    RegionSummary(gov_ar="حماة",     gov_en="Hama",           lat=35.13, lng=36.75, intensity=0.70, area_rank=4,  top_crop_ar="قمح",       production_score=76),
    RegionSummary(gov_ar="الرقة",    gov_en="Raqqa",          lat=35.95, lng=39.01, intensity=0.63, area_rank=3,  top_crop_ar="قمح",       production_score=68),
    RegionSummary(gov_ar="حمص",      gov_en="Homs",           lat=34.73, lng=36.72, intensity=0.58, area_rank=5,  top_crop_ar="زيتون",     production_score=62),
    RegionSummary(gov_ar="دير الزور",gov_en="Deir ez-Zor",   lat=35.34, lng=40.14, intensity=0.55, area_rank=6,  top_crop_ar="قطن",       production_score=58),
    RegionSummary(gov_ar="دمشق",     gov_en="Damascus",       lat=33.51, lng=36.29, intensity=0.50, area_rank=14, top_crop_ar="خضروات",    production_score=52),
    RegionSummary(gov_ar="اللاذقية", gov_en="Latakia",        lat=35.52, lng=35.79, intensity=0.45, area_rank=11, top_crop_ar="زيتون",     production_score=48),
    RegionSummary(gov_ar="ريف دمشق",gov_en="Rural Damascus", lat=33.62, lng=36.55, intensity=0.42, area_rank=7,  top_crop_ar="خضروات",    production_score=45),
    RegionSummary(gov_ar="إدلب",     gov_en="Idlib",          lat=35.93, lng=36.63, intensity=0.40, area_rank=8,  top_crop_ar="زيتون",     production_score=42),
    RegionSummary(gov_ar="طرطوس",    gov_en="Tartus",         lat=34.89, lng=35.89, intensity=0.38, area_rank=12, top_crop_ar="حمضيات",    production_score=40),
    RegionSummary(gov_ar="السويداء", gov_en="As-Suwayda",    lat=32.71, lng=36.57, intensity=0.32, area_rank=9,  top_crop_ar="عنب",       production_score=35),
    RegionSummary(gov_ar="درعا",     gov_en="Daraa",          lat=32.62, lng=36.10, intensity=0.28, area_rank=13, top_crop_ar="طماطم",     production_score=30),
    RegionSummary(gov_ar="القنيطرة",gov_en="Quneitra",       lat=33.13, lng=35.82, intensity=0.18, area_rank=10, top_crop_ar="قمح",       production_score=20),
]

# Build once at module load
_ALL_CROPS: list[CropData] = _build_crops()
_CROP_INDEX: dict[str, CropData] = {c.key: c for c in _ALL_CROPS}
_REGION_INDEX: dict[str, RegionSummary] = {r.gov_ar: r for r in _ALL_REGIONS}


def _now() -> str:
    return datetime.now(UTC).isoformat()


# ── Routes ────────────────────────────────────────────────────────────
@router.get(
    "/crops",
    response_model=MarketCropsResponse,
    summary="List all crops with current prices",
)
async def get_crops(
    category: Optional[str] = Query(None, description="Filter: strategic | vegetables | fruits | grains"),
    region: Optional[str] = Query(None, description="Filter by governorate name_ar"),
) -> MarketCropsResponse:
    crops = _ALL_CROPS
    if category:
        crops = [c for c in crops if c.category == category]
    # region filter applies a production-based sort boost (mock — real data would filter yields)
    if region and region not in _REGION_INDEX:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found")
    return MarketCropsResponse(crops=crops, total=len(crops), last_updated=_now())


@router.get(
    "/regions",
    response_model=MarketRegionsResponse,
    summary="Governorate production summaries (14 provinces)",
)
async def get_regions() -> MarketRegionsResponse:
    return MarketRegionsResponse(regions=_ALL_REGIONS, last_updated=_now())


@router.get(
    "/summary",
    response_model=MarketSummaryResponse,
    summary="Full dashboard payload — crops + regions in one call",
)
async def get_summary(
    category: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
) -> MarketSummaryResponse:
    crops = _ALL_CROPS
    if category:
        crops = [c for c in crops if c.category == category]
    regions = (
        [_REGION_INDEX[region]] if region and region in _REGION_INDEX else _ALL_REGIONS
    )
    return MarketSummaryResponse(crops=crops, regions=regions, last_updated=_now())


@router.get(
    "/prices/{crop_key}",
    response_model=list[PriceHistoryPoint],
    summary="6-month price history for a single crop",
)
async def get_price_history(crop_key: str) -> list[PriceHistoryPoint]:
    crop = _CROP_INDEX.get(crop_key)
    if not crop:
        raise HTTPException(status_code=404, detail=f"Crop '{crop_key}' not found")
    return crop.history
