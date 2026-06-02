"""POST /api/admin/reindex — rebuild the RAG knowledge-base index on demand."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.logging import get_logger
from app.core.rag_engine import force_reindex

router = APIRouter(prefix="/api/admin", tags=["admin"])
log = get_logger("agro_syria.routes.admin")


class ReindexResponse(BaseModel):
    status: str
    backend: str = ""
    chunks: int = 0
    sources: list[str] = []
    detail: str = ""


@router.post("/reindex", response_model=ReindexResponse, summary="Rebuild RAG index")
async def reindex() -> ReindexResponse:
    """Drop the current vector index and rebuild from all files in knowledge_base/.

    Trigger this after adding or updating .txt or .pdf files.
    """
    import asyncio
    log.info("Manual re-index triggered via API")
    result = await asyncio.get_event_loop().run_in_executor(None, force_reindex)
    log.info("Re-index complete: %s", result)
    return ReindexResponse(**result)
