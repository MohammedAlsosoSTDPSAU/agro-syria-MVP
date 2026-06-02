"""Pydantic models for field / sensor data."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SoilReading(BaseModel):
    field_id: str = Field(..., examples=["north-field"])
    field_name_ar: str = Field(..., examples=["حقل الشمال"])
    moisture_pct: float = Field(..., ge=0, le=100, examples=[65.0])
    ph: float = Field(..., examples=[6.8])
    nitrogen_level: str = Field(..., examples=["medium"])
    phosphorus_level: str = Field(..., examples=["adequate"])
    depth_cm: int = Field(..., examples=[30])
    agent_comment_ar: str = Field(
        ...,
        description="Field Agent observation in Syrian dialect",
    )


class SoilResponse(BaseModel):
    readings: list[SoilReading]
    average_moisture: float = Field(..., ge=0, le=100)
    system_note_ar: str = Field(
        default="البيانات محاكاة — سيتم ربط الحساسات الحقيقية في المرحلة القادمة.",
    )
