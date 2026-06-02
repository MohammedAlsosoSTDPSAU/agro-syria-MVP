"""Health-check response models."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., examples=["active"])
    system: str = Field(..., examples=["Agro-Syria AI"])
    version: str = Field(..., examples=["0.1.0-demo"])
    environment: str = Field(..., examples=["development"])
    message_ar: str = Field(
        default="النظام يعمل بشكل طبيعي",
        description="Arabic status message",
    )
