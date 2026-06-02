"""Health-check route."""

from fastapi import APIRouter

from app.core.config import get_settings
from app.schema.health import HealthResponse

router = APIRouter(prefix="/api", tags=["system"])
_settings = get_settings()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="System health check",
    description="Returns the live status of the Agro-Syria AI system.",
)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="active",
        system=_settings.app_name,
        version=_settings.app_version,
        environment=_settings.app_env,
        message_ar="النظام يعمل بشكل طبيعي ✓",
    )
