"""Structured, Unicode-safe logging configuration.

Supports Arabic log messages without escaping issues.
"""

import logging
import sys
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    pass  # avoids circular import — settings is typed via Any at runtime

import uvicorn.logging  # reuse uvicorn's colour formatter

RESET = "\033[0m"
GREEN = "\033[32m"
CYAN = "\033[36m"
YELLOW = "\033[33m"
RED = "\033[31m"
BOLD = "\033[1m"
DIM = "\033[2m"


class AgroFormatter(logging.Formatter):
    """Coloured formatter that renders Arabic text correctly on UTF-8 terminals."""

    LEVEL_COLOURS: dict[int, str] = {
        logging.DEBUG: DIM,
        logging.INFO: GREEN,
        logging.WARNING: YELLOW,
        logging.ERROR: RED,
        logging.CRITICAL: BOLD + RED,
    }

    FMT = "{colour}[{level}]{reset} {dim}{name}{reset}  {msg}"

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        colour = self.LEVEL_COLOURS.get(record.levelno, "")
        level = record.levelname.ljust(8)
        name = record.name
        msg = record.getMessage()
        return self.FMT.format(
            colour=colour,
            level=level,
            reset=RESET,
            dim=DIM,
            name=name,
            msg=msg,
        )


def setup_logging(level: int = logging.INFO) -> None:
    """Configure root logger and silence noisy third-party loggers."""
    handler = logging.StreamHandler(sys.stdout)
    handler.stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    handler.setFormatter(AgroFormatter())

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    # Quiet down libraries we don't need verbose output from
    for noisy in ("httpx", "httpcore", "openai", "langchain"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def log_tracing_status(settings: Any) -> None:
    """Emit a startup log line confirming whether LangSmith tracing is live."""
    log = get_logger("agro_syria.tracing")
    if settings.tracing_enabled:
        # Only log the project name — never the key itself
        log.info(
            "LangChain Tracing is Active — project=%s endpoint=https://api.smith.langchain.com",
            settings.langchain_project,
        )
    else:
        log.info("LangChain Tracing is DISABLED (set LANGCHAIN_TRACING_V2=true + LANGCHAIN_API_KEY to enable)")
