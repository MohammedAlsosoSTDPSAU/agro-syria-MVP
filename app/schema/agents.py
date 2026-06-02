"""Pydantic models for the agent-status API."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AgentStatus(str, Enum):
    active = "active"
    idle = "idle"
    processing = "processing"
    alert = "alert"
    offline = "offline"


class AgentInfo(BaseModel):
    id: str = Field(..., examples=["strategist"])
    name_en: str = Field(..., examples=["Strategist"])
    name_ar: str = Field(..., examples=["المخطط الاستراتيجي"])
    role_ar: str = Field(..., description="Agent role description in Syrian dialect")
    status: AgentStatus
    metric: Optional[str] = Field(None, examples=["٣ خطط"])
    icon: str = Field(..., description="Lucide icon name for the frontend")


class AgentStatusResponse(BaseModel):
    agents: list[AgentInfo]
    active_count: int = Field(..., description="Number of active or processing agents")
    total_count: int
    system_healthy: bool
