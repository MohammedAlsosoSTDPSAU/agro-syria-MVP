"""Pydantic schemas for the /api/agent/chat endpoint."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class UserField(BaseModel):
    """Mirrors the Next.js frontend's UserField (web/src/lib/api.ts)."""
    nameAr: str
    cropAr: str
    areaHa: float
    provinceAr: str


class UserContext(BaseModel):
    """Mirrors the Next.js frontend's UserContext (web/src/lib/api.ts)."""
    fields: list[UserField] = Field(default_factory=list)
    active_crops: list[str] = Field(default_factory=list)
    preferred_province: str | None = None


class ChatRequest(BaseModel):
    # message can be empty when an image is the sole input
    message: str = Field(default="", max_length=2000)
    session_id: str | None = None
    # raw base64 (with or without "data:image/...;base64," prefix) — max ~6.7 MB for 5 MB image
    image_base64: str | None = Field(default=None, max_length=9_000_000)
    user_context: UserContext | None = None

    @model_validator(mode="after")
    def require_message_or_image(self) -> "ChatRequest":
        if not self.message.strip() and not self.image_base64:
            raise ValueError("Either message or image_base64 must be provided")
        return self


class AgentThought(BaseModel):
    agent: str
    role_ar: str
    thought: str
    is_status: bool = False


# ── Visualization schemas ───────────────────────────────────────────────

class VisualizationPoint(BaseModel):
    """A geographic point on the Syria map."""
    lat: float
    lng: float
    label_ar: str
    intensity: float = Field(default=0.5, ge=0.0, le=1.0)


class ChartBar(BaseModel):
    """A single bar in a bar chart."""
    label_ar: str
    value: float
    color: Literal["emerald", "amber", "red"] = "emerald"


class VisualizationData(BaseModel):
    """Structured visualization payload attached to a chat response.

    type="map"       → Syria map with colored intensity markers
    type="bar_chart" → Horizontal bar chart for numerical comparisons
    """
    type: Literal["map", "bar_chart"]
    title_ar: str
    points: list[VisualizationPoint] | None = None
    bars: list[ChartBar] | None = None
    source_ar: str | None = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    chain_of_thought: list[AgentThought]
    tokens_used: int | None = None
    visualization: VisualizationData | None = None
