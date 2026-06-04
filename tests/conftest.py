"""Shared pytest fixtures for the Agro-Syria agent test suite.

The suite targets the canonical top-level ``app`` package (the ``api/app`` copy
is byte-identical, kept in sync by the build steps), so a single suite at the
repo root covers both.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Ensure the repo root (which contains the ``app`` package) is importable
# regardless of pytest's import mode / invocation directory.
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


@pytest.fixture(scope="session", autouse=True)
def _force_local_synthesis() -> None:
    """Pin the SynthesizerAgent to its offline local-synthesis path.

    Keeps the end-to-end tests deterministic and network-free: the final reply
    is produced by ``_local_synthesis`` rather than a live OpenAI call. This
    mirrors the server's own behaviour when no usable API key is present.
    """
    from app.core import llm_health

    llm_health.mark_openai_unavailable()
