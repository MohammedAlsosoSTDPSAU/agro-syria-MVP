"""Field sensor data routes.

Returns soil readings per field. Data is currently mocked;
real sensor integration is planned for Phase 3.
"""

from fastapi import APIRouter

from app.schema.fields import SoilReading, SoilResponse

router = APIRouter(prefix="/api/fields", tags=["fields"])

# ---------------------------------------------------------------------------
# Mock readings — replace with DB / sensor queries in Phase 3
# ---------------------------------------------------------------------------
_MOCK_READINGS: list[SoilReading] = [
    SoilReading(
        field_id="north-field",
        field_name_ar="حقل الشمال",
        moisture_pct=65.0,
        ph=6.8,
        nitrogen_level="medium",
        phosphorus_level="adequate",
        depth_cm=30,
        agent_comment_ar="الجو مثالي للري اليوم، بس انتبه في موجة حر جاية بعد يومين.",
    ),
    SoilReading(
        field_id="south-field",
        field_name_ar="حقل الجنوب",
        moisture_pct=58.0,
        ph=7.1,
        nitrogen_level="low",
        phosphorus_level="adequate",
        depth_cm=25,
        agent_comment_ar="مستوى النيتروجين منخفض شوي — فكر في إضافة سماد.",
    ),
    SoilReading(
        field_id="east-orchard",
        field_name_ar="بستان الشرق",
        moisture_pct=72.0,
        ph=6.5,
        nitrogen_level="high",
        phosphorus_level="high",
        depth_cm=35,
        agent_comment_ar="التربة ممتازة، استمر بنفس نظام الري.",
    ),
]


@router.get(
    "/soil",
    response_model=SoilResponse,
    summary="Soil sensor readings",
    description="Returns current soil moisture and nutrient readings for all registered fields.",
)
async def get_soil_data() -> SoilResponse:
    avg = sum(r.moisture_pct for r in _MOCK_READINGS) / len(_MOCK_READINGS)
    return SoilResponse(readings=_MOCK_READINGS, average_moisture=round(avg, 1))
