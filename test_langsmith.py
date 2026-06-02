"""
LangSmith connection diagnostic — run from any directory:
    python api/test_langsmith.py   OR   python test_langsmith.py

Checks (in order):
  1. pydantic-settings reads .env correctly
  2. langsmith SDK authentication (list_projects)
  3. Environment variable aliases
  4. Full LangGraph trace sent to LangSmith
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

# ── Always resolve relative to this file's location (api/) ───────────
_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
os.chdir(_HERE)

from app.core.config import get_settings  # noqa: E402

s = get_settings()

SEP = "─" * 60

# ── STEP 1: pydantic-settings ─────────────────────────────────────────
print(SEP)
print("STEP 1 — pydantic-settings field mapping")
print(SEP)
raw_key = s.langchain_api_key
key_display = f"{raw_key[:16]}...{raw_key[-6:]}" if len(raw_key) > 22 else "(empty!)"
print(f"  langchain_tracing_v2 : {s.langchain_tracing_v2}")
print(f"  langchain_project    : {s.langchain_project}")
print(f"  langchain_api_key    : {key_display}")
print(f"  key length           : {len(raw_key)} chars")
print(f"  key type             : {'Personal Access Token (pt) ✓' if 'pt' in raw_key[:12] else 'Service Key (sk) — may lack write perms' if 'sk' in raw_key[:12] else 'unknown'}")
print(f"  tracing_enabled      : {s.tracing_enabled}")

if not raw_key:
    print("\n[FAIL] langchain_api_key is empty.")
    print("  Check that .env has: LANGCHAIN_API_KEY=lsv2_pt_...")
    sys.exit(1)

step1_ok = True

# ── STEP 2: SDK authentication ────────────────────────────────────────
print()
print(SEP)
print("STEP 2 — langsmith SDK authentication")
print(SEP)

try:
    from langsmith import Client

    client = Client(api_key=raw_key)
    projects = list(client.list_projects())
    print(f"  ✓ Auth accepted — {len(projects)} project(s) in this workspace:")
    for p in projects[:8]:
        print(f"    · {p.name}")
    if not projects:
        print("    (none yet — will be auto-created on first trace)")
    sdk_ok = True
except Exception as exc:
    print(f"  ✗ FAIL — {type(exc).__name__}: {exc}")
    sdk_ok = False

# ── STEP 3: env-var aliases ───────────────────────────────────────────
print()
print(SEP)
print("STEP 3 — os.environ aliases (set by configure_tracing)")
print(SEP)
print("  (configure_tracing runs below — values will show in server logs)")
for var in [
    "LANGCHAIN_API_KEY", "LANGSMITH_API_KEY",
    "LANGCHAIN_TRACING_V2", "LANGSMITH_TRACING",
    "LANGCHAIN_PROJECT",  "LANGSMITH_PROJECT",
]:
    val = os.environ.get(var, "(not set — will be set by configure_tracing at startup)")
    if "KEY" in var and val.startswith("lsv2"):
        val = val[:16] + "..."
    print(f"  {var:<28} = {val}")

# ── STEP 4: full LangGraph trace ──────────────────────────────────────
print()
print(SEP)
print("STEP 4 — Full LangGraph trace to LangSmith")
print(SEP)

trace_ok = False

if not sdk_ok:
    print("  Skipped — fix auth (Step 2) first.")
else:
    from app.core.tracing import configure_tracing
    configure_tracing(s)  # pushes vars to os.environ before ainvoke

    from langchain_core.messages import HumanMessage
    from app.core.graph import get_compiled_graph

    async def _send_trace() -> str:
        graph = get_compiled_graph()
        run_id = str(uuid.uuid4())
        await graph.ainvoke(
            {
                "messages": [HumanMessage(content="مرحبا")],
                "sender": "user",
                "agricultural_context": {},
            },
            config={
                "run_id":   run_id,
                "tags":     ["diagnostic", "agro-syria"],
                "metadata": {"project": s.langchain_project, "type": "diagnostic"},
                "run_name": "agro-syria-diagnostic",
            },
        )
        return run_id

    try:
        sent_id = asyncio.run(_send_trace())
        print(f"  ✓ Trace sent — run_id = {sent_id}")
        print(f"  → View at: https://smith.langchain.com/projects/{s.langchain_project}")
        trace_ok = True
    except Exception as exc:
        print(f"  ✗ FAIL — {type(exc).__name__}: {exc}")

# ── SUMMARY ───────────────────────────────────────────────────────────
print()
print(SEP)
print("SUMMARY")
print(SEP)
print(f"  [{'✓' if step1_ok else '✗'}] pydantic-settings reads key")
print(f"  [{'✓' if sdk_ok   else '✗'}] LangSmith SDK auth (list_projects)")
print(f"  [{'✓' if trace_ok else '✗'}] Full LangGraph trace sent")

all_ok = step1_ok and sdk_ok and trace_ok
if all_ok:
    print()
    print("  LangSmith tracing is FULLY OPERATIONAL.")
    print(f"  Dashboard → https://smith.langchain.com/projects/{s.langchain_project}")
else:
    print()
    if not sdk_ok:
        print("  ACTION: Replace LANGCHAIN_API_KEY in api/.env.")
        print("  Get a Personal Access Token at smith.langchain.com → Settings → API Keys.")
    if not trace_ok and sdk_ok:
        print("  ACTION: Trace send failed — check langsmith WARNING lines above.")
