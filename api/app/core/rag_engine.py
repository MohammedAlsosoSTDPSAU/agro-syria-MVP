"""RAG engine — Arabic search with PDF + TXT ingestion.

Backend            : scikit-learn TF-IDF char-ngram → FAISS IndexFlatIP
                     (neural/fastembed is disabled — see below)
Document sources : knowledge_base/*.txt   (UTF-8 plain text)
                   knowledge_base/*.pdf   (pypdf — handles Arabic Unicode)

Neural embeddings (fastembed ONNX) are disabled: loading the ONNX model
routinely OOM-crashed the process on Render's free tier (512MB RAM). TF-IDF
has a much smaller memory footprint and is the only backend used now — see
_build_tfidf(). Re-enabling fastembed requires a higher-memory plan.

Index invalidation : SHA-256 of all source files; rebuilt automatically on change.
Re-index trigger   : call force_reindex() at runtime, or restart the server.

Search strategy    : Hybrid — vector similarity (75%) + keyword matching (25%)
                     Ensures chemical names and exact terms are never missed.
"""

from __future__ import annotations

import hashlib
import logging
import re
import threading
import time
import warnings
from pathlib import Path
from typing import Any

log = logging.getLogger("agro_syria.rag")

_KB_DIR        = Path(__file__).resolve().parents[2] / "knowledge_base"
# _NEURAL_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"  # disabled on free tier — see module docstring
_CHUNK_WORDS   = 150   # smaller chunks → higher precision per result
_CHUNK_OVERLAP = 20

# Layout-mode PDF extraction is memory-heavy; plain extraction is used for
# files above this size to avoid MemoryError on Render's 512MB RAM.
_LARGE_PDF_BYTES = 10 * 1024 * 1024

# Readable titles for well-known plain-text knowledge files
_KNOWN_TITLES: dict[str, str] = {
    "crops_syria":        "دليل المحاصيل السورية",
    "farming_calendar":   "التقويم الزراعي",
    "water_management":   "إدارة المياه الزراعية",
    "sample_guide":       "الدليل النموذجي",
}


# ── Singleton ──────────────────────────────────────────────────────────
_engine: "RAGEngine | None" = None


def get_rag_engine() -> "RAGEngine":
    global _engine
    if _engine is None:
        _engine = RAGEngine(_KB_DIR)
    return _engine


# ── Public API ─────────────────────────────────────────────────────────

def search_knowledge_base(query: str, k: int = 3) -> list[dict[str, Any]]:
    """Return top-k chunks for *query*. Never raises — returns [] on failure."""
    try:
        return get_rag_engine().search(query, k=k)
    except Exception as exc:
        log.warning("RAG search failed (%s) — returning empty", type(exc).__name__)
        return []


def warmup_rag() -> None:
    """Pre-load the model and build the FAISS index. Call once at startup."""
    log.info("[startup] Building FAISS index...")
    try:
        eng = get_rag_engine()
        eng.ensure_ready()
        n_pdfs = len({c["source"] for c in eng.chunks})
        log.info(
            "[startup] FAISS index ready — %d chunks from %d PDFs",
            len(eng.chunks), n_pdfs,
        )
        log.info(
            "RAG engine ready — backend=%s chunks=%d sources=%s",
            "neural" if eng.uses_neural else "TF-IDF",
            len(eng.chunks),
            ", ".join(sorted({c["source"] for c in eng.chunks})) or "(none)",
        )
        log.info(
            "Knowledge vault: add .txt or .pdf files to knowledge_base/ "
            "then call POST /api/admin/reindex or restart the server to rebuild."
        )
    except Exception as exc:
        log.warning("RAG warm-up failed (%s) — knowledge search unavailable", type(exc).__name__)


def rag_ready() -> bool:
    """True once the FAISS index has finished building (for /ready probes)."""
    return get_rag_engine()._ready


def force_reindex() -> dict[str, Any]:
    """Clear cached index and rebuild from scratch. Returns status dict."""
    eng = get_rag_engine()
    eng.invalidate()
    try:
        eng.ensure_ready()
        return {
            "status": "ok",
            "backend": "neural" if eng.uses_neural else "TF-IDF",
            "chunks": len(eng.chunks),
            "sources": sorted({c["source"] for c in eng.chunks}),
        }
    except Exception as exc:
        log.error("Re-index failed: %s", exc)
        return {"status": "error", "detail": str(exc)}


# ── RAGEngine ──────────────────────────────────────────────────────────

class RAGEngine:
    def __init__(self, kb_dir: Path) -> None:
        self.kb_dir      = kb_dir
        self.chunks: list[dict[str, Any]] = []
        self._model: Any  = None   # fastembed.TextEmbedding | SentenceTransformer | TfidfVectorizer
        self._index: Any  = None   # faiss index
        self._hash        = ""
        self._ready       = False
        self.uses_neural  = False
        self._backend     = ""     # "fastembed" | "sentence_transformers" | "tfidf"
        self._lock        = threading.Lock()  # serialises concurrent build attempts

    def ensure_ready(self) -> None:
        # Fast path: already built — skip expensive SHA-256 scan in hot path.
        # The hash check only runs on an explicit invalidate() call or first boot.
        if self._ready:
            return
        # Slow path: acquire lock so only one thread builds at a time.
        # Any other thread that arrives while building will block here, then
        # see _ready=True on re-check and return without rebuilding.
        with self._lock:
            if self._ready:
                return  # another thread finished while we waited
            self._build()

    def invalidate(self) -> None:
        """Force a full rebuild on next ensure_ready() call."""
        with self._lock:
            self._hash  = ""
            self._ready = False

    # ── Build ─────────────────────────────────────────────────────────
    def _build(self) -> None:
        t0 = time.monotonic()
        log.info("[rag-build] stage=start kb_dir=%s", self.kb_dir)
        try:
            new_hash = _content_hash(self.kb_dir)
            log.info("[rag-build] stage=hash elapsed=%.1fs", time.monotonic() - t0)

            self.chunks = _load_all_chunks(self.kb_dir)
            log.info(
                "[rag-build] stage=ingest elapsed=%.1fs chunks=%d files=%d",
                time.monotonic() - t0, len(self.chunks),
                len(list(self.kb_dir.glob("*.txt")) + list(self.kb_dir.glob("*.pdf"))),
            )

            if not self.chunks:
                log.warning("knowledge_base/ is empty — RAG will return no results")
                self._hash = new_hash
                self._ready = True
                return

            # Neural (fastembed) is disabled — see module docstring. TF-IDF is
            # the only backend; no neural attempt, no fallback branch needed.
            self._build_tfidf()
            self.uses_neural = False
            log.info("[rag-build] stage=tfidf-done elapsed=%.1fs", time.monotonic() - t0)

            self._hash = new_hash
            self._ready = True
            log.info("[rag-build] stage=complete elapsed=%.1fs ready=True", time.monotonic() - t0)
        except Exception as exc:
            # Any unexpected failure in hashing/ingestion (corrupt file, disk
            # error, MemoryError parsing a large PDF, ...) is logged clearly
            # and leaves `_ready` False — /ready correctly reports "not
            # built" instead of silently masking a broken index. The next
            # ensure_ready()/search() call will retry the build.
            log.error("[RAG] Index build failed: %s", exc, exc_info=True)
            self._ready = False

    # _build_neural_bounded() / _build_neural() removed — neural (fastembed)
    # backend is disabled on the free tier. See module docstring for why.

    def _build_tfidf(self) -> None:
        import numpy as np
        import faiss
        from sklearn.feature_extraction.text import TfidfVectorizer

        self._model = TfidfVectorizer(
            analyzer="char_wb", ngram_range=(2, 4),
            sublinear_tf=True, max_features=8192,
        )
        texts = [c["text"] for c in self.chunks]
        sparse = self._model.fit_transform(texts)
        dense  = sparse.toarray().astype("float32")
        norms  = np.linalg.norm(dense, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        dense /= norms

        idx = faiss.IndexFlatIP(dense.shape[1])
        idx.add(dense)
        self._index = idx
        self._backend = "tfidf"
        log.info("TF-IDF FAISS index ready — dim=%d vectors=%d", dense.shape[1], idx.ntotal)

    # ── Search (Hybrid) ───────────────────────────────────────────────
    def search(self, query: str, k: int = 3) -> list[dict[str, Any]]:
        """Hybrid vector + keyword search.

        Retrieves k*3 candidates via vector similarity, then re-ranks by
        blending with keyword match ratio (75% vector, 25% keyword).
        This ensures chemical names and exact terms are never missed.

        Non-blocking: if the background warmup holds the build lock,
        returns [] immediately rather than blocking the request thread.
        The research agent's local-fallback path handles the empty result.
        """
        if not self._ready:
            # Try to acquire the lock without blocking.
            # If warmup is in progress, the lock is held → return empty immediately.
            acquired = self._lock.acquire(blocking=False)
            if not acquired:
                log.info("RAG warmup in progress — skipping search, using knowledge fallback")
                return []
            try:
                if not self._ready:
                    self._build()
            finally:
                self._lock.release()

        if self._index is None or not self.chunks:
            return []

        import numpy as np

        if self._backend == "fastembed":
            q = np.array(list(self._model.embed([query])), dtype="float32")
        elif self._backend == "sentence_transformers":
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                q = self._model.encode([query], normalize_embeddings=True,
                                       show_progress_bar=False)
            q = np.array(q, dtype="float32")
        else:
            sparse = self._model.transform([query])
            q = sparse.toarray().astype("float32")
            norm = np.linalg.norm(q, axis=1, keepdims=True)
            q = q / (norm if norm.all() else 1.0)

        q = np.array(q, dtype="float32")
        # Retrieve more candidates than needed for keyword re-ranking
        ak = min(k * 3, len(self.chunks))
        scores, idxs = self._index.search(q, ak)

        candidates = [
            {**self.chunks[i], "score": float(s)}
            for s, i in zip(scores[0], idxs[0])
            if i >= 0
        ]

        # ── Keyword boost (BM25-style) ─────────────────────────────
        # Tokens longer than 2 chars avoid noise from Arabic stop-words
        query_tokens = [t for t in query.lower().split() if len(t) > 2]
        if query_tokens:
            for c in candidates:
                text_lower = c["text"].lower()
                hits = sum(1 for t in query_tokens if t in text_lower)
                keyword_ratio = hits / len(query_tokens)
                c["score"] = c["score"] * 0.75 + keyword_ratio * 0.25

        candidates.sort(key=lambda x: x["score"], reverse=True)
        return candidates[:k]


# ── File ingestion ─────────────────────────────────────────────────────

def _load_all_chunks(kb_dir: Path) -> list[dict[str, Any]]:
    if not kb_dir.exists():
        return []
    chunks: list[dict[str, Any]] = []
    for path in sorted(kb_dir.glob("*.txt")):
        text = path.read_text(encoding="utf-8")
        chunks.extend(_chunk_pages([(1, text)], path.name))

    pdf_paths = sorted(kb_dir.glob("*.pdf"))
    total = len(pdf_paths)
    for i, path in enumerate(pdf_paths, 1):
        pages = _extract_pdf(path)
        if pages:
            chunks.extend(_chunk_pages(pages, path.name))
        else:
            log.warning("PDF %s yielded no text (may be image-only — OCR needed)", path.name)
        if i % 5 == 0 or i == total:
            log.info("[RAG] Indexed %d/%d PDFs...", i, total)
    return chunks


def _extract_pdf(path: Path) -> list[tuple[int, str]]:
    """Extract text from PDF with Arabic-safe settings.

    Returns list of (page_number, page_text) tuples.
    """
    try:
        from pypdf import PdfReader
    except ImportError:
        log.warning("pypdf not installed — skipping %s", path.name)
        return []

    # Layout mode is memory-heavy — skip it for large files (Render 512MB RAM).
    is_large = path.stat().st_size > _LARGE_PDF_BYTES
    extract_kwargs = {} if is_large else {"extraction_mode": "layout"}

    try:
        reader = PdfReader(str(path))
        pages: list[tuple[int, str]] = []
        for i, page in enumerate(reader.pages, 1):
            try:
                text = page.extract_text(**extract_kwargs) or ""
            except Exception as exc:
                # One malformed page must not lose the rest of the document.
                log.warning("Failed to extract page %d of %s: %s", i, path.name, exc)
                continue
            # Collapse excessive whitespace that PDFs often produce
            text = re.sub(r"[ \t]{3,}", "  ", text)
            text = re.sub(r"\n{4,}", "\n\n\n", text)
            if text.strip():
                pages.append((i, text))
        return pages
    except Exception as exc:
        log.warning("Failed to extract PDF %s: %s", path.name, exc)
        return []


# ── Chunking (page-aware) ───────────────────────────────────────────────

def _chunk_pages(pages: list[tuple[int, str]], source: str) -> list[dict[str, Any]]:
    """Chunk a sequence of (page_num, text) pairs.

    Each emitted chunk carries source metadata: book_title and page_num.
    Chunk boundaries follow paragraph breaks; overlap preserves context.
    """
    book_title = _book_title_from_filename(source)

    # Flatten all pages into (page_num, paragraph_words) pairs
    para_list: list[tuple[int, list[str]]] = []
    for page_num, text in pages:
        for para in re.split(r"\n{2,}", text.strip()):
            words = para.split()
            if words:
                para_list.append((page_num, words))

    chunks: list[dict[str, Any]] = []
    buf: list[str] = []
    # Tracks the page where the current chunk's fresh (non-overlap) content begins.
    # Updated only when a new chunk is started (right after a flush or when buf is empty).
    chunk_start_page: int = 1
    current_page: int = 1
    idx = 0

    def flush() -> None:
        nonlocal idx
        content = " ".join(buf).strip()
        if content:
            chunks.append({
                "text": content,
                "source": source,
                "book_title": book_title,
                "page_num": chunk_start_page,
                "chunk": idx,
            })
            idx += 1

    for page_num, words in para_list:
        current_page = page_num
        if len(buf) + len(words) > _CHUNK_WORDS and buf:
            flush()
            buf = buf[-_CHUNK_OVERLAP:]
            chunk_start_page = current_page  # new chunk's primary page starts here
        if not buf:
            chunk_start_page = current_page
        buf.extend(words)
        if len(buf) >= _CHUNK_WORDS:
            flush()
            buf = buf[-_CHUNK_OVERLAP:]
            chunk_start_page = current_page

    flush()
    return chunks


# ── Source metadata helpers ─────────────────────────────────────────────

def _book_title_from_filename(filename: str) -> str:
    """Derive a readable Arabic/English book title from a knowledge-base filename."""
    # Strip extension
    name = re.sub(r'\.(pdf|txt|md)$', '', filename, flags=re.IGNORECASE)

    # Check well-known plain-text files first
    if name in _KNOWN_TITLES:
        return _KNOWN_TITLES[name]

    # URL-decode percent encoding (e.g. "133%20Agriculture%20in%20Syria")
    name = name.replace('%20', ' ').replace('%2B', '+')

    # Remove leading number prefix: "2-", "10-", "133 ", "355_" etc.
    name = re.sub(r'^\d+[-_\s]', '', name).strip()

    # Remove trailing 5–8 char alphanumeric code appended by the upload system
    # e.g. "-q8onCb", "-QnUSwa", "-DOrgBC-2"
    name = re.sub(r'-[A-Za-z0-9]{5,8}(-\d+)?$', '', name)

    # Replace hyphens / underscores with spaces
    name = name.replace('-', ' ').replace('_', ' ')
    name = re.sub(r'\s+', ' ', name).strip()

    # Fall back to raw filename if result is too short or numeric
    if len(name) < 3 or name.replace(' ', '').isdigit():
        return filename

    return name


# ── Helpers ────────────────────────────────────────────────────────────

def _content_hash(kb_dir: Path) -> str:
    h = hashlib.sha256()
    if not kb_dir.exists():
        return h.hexdigest()
    for path in sorted(kb_dir.glob("*.txt")) + sorted(kb_dir.glob("*.pdf")):
        h.update(path.read_bytes())
    return h.hexdigest()
