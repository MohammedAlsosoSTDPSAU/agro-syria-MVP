"""Pydantic models for the Market Intelligence API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# ── Primitives ────────────────────────────────────────────────────────
CropCategory = Literal["strategic", "vegetables", "fruits", "grains"]


class PriceHistoryPoint(BaseModel):
    month_ar: str = Field(..., examples=["يناير"])
    price: float = Field(..., ge=0, examples=[420.0])


class CropData(BaseModel):
    key: str = Field(..., examples=["wheat"])
    name_ar: str = Field(..., examples=["قمح"])
    name_en: str = Field(..., examples=["Wheat"])
    category: CropCategory
    unit: str = Field(default="ل.س/كغ")
    price_syp: float = Field(..., ge=0)
    price_prev: float = Field(..., ge=0)
    change_pct: float
    top_gov_ar: str = Field(..., examples=["الحسكة"])
    yield_ton_ha: float = Field(..., ge=0)
    area_ha: float = Field(..., ge=0, description="Cultivated area in thousands of hectares")
    production_ton: float = Field(..., ge=0, description="Total production in thousands of tons")
    season: str = Field(..., examples=["مايو–يونيو"])
    history: list[PriceHistoryPoint] = Field(default_factory=list)


class RegionSummary(BaseModel):
    gov_ar: str = Field(..., examples=["الحسكة"])
    gov_en: str = Field(..., examples=["Al-Hasakah"])
    lat: float
    lng: float
    intensity: float = Field(..., ge=0, le=1)
    area_rank: int = Field(..., ge=1, le=14)
    top_crop_ar: str
    production_score: int = Field(..., ge=0, le=100)


class MarketCropsResponse(BaseModel):
    crops: list[CropData]
    total: int
    season_ar: str = Field(default="موسم ٢٠٢٦")
    last_updated: str


class MarketRegionsResponse(BaseModel):
    regions: list[RegionSummary]
    last_updated: str


class MarketSummaryResponse(BaseModel):
    crops: list[CropData]
    regions: list[RegionSummary]
    season_ar: str = Field(default="موسم ٢٠٢٦")
    last_updated: str
