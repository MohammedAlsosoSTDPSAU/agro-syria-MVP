# أغرو-سيريا — API Backend

FastAPI + LangGraph backend for the Agro-Syria precision-agriculture platform.

---

## Quick start

The backend lives in `api/` — all commands below run from there.

```bash
cd api
```

### 1 — Create and activate a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate          # macOS / Linux
# .venv\Scripts\activate           # Windows
```

### 2 — Install dependencies

```bash
pip install -r requirements.txt
```

### 3 — Configure environment variables

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY (required for agent features)
```

### 4 — Run the development server

```bash
uvicorn main:app --reload --port 8000
```

The API is now available at **http://localhost:8000**.

---

## Available endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | System health check |
| `GET` | `/api/agents/status` | Live status of all 5 AI agents |
| `GET` | `/api/docs` | Interactive Swagger UI |
| `GET` | `/api/redoc` | ReDoc documentation |

### Example responses

**`GET /api/health`**
```json
{
  "status": "active",
  "system": "Agro-Syria AI",
  "version": "0.1.0-demo",
  "environment": "development",
  "message_ar": "النظام يعمل بشكل طبيعي ✓"
}
```

**`GET /api/agents/status`**
```json
{
  "agents": [
    {
      "id": "strategist",
      "name_ar": "المخطط الاستراتيجي",
      "status": "active",
      "metric": "٣ خطط"
    }
  ],
  "active_count": 4,
  "total_count": 5,
  "system_healthy": true
}
```

---

## Project structure

```
api/
├── main.py                  ← FastAPI application entry point
├── requirements.txt
├── .env.example             ← Copy to .env and fill in secrets
└── app/
    ├── core/
    │   ├── config.py        ← Pydantic-settings: all env vars
    │   └── logging.py       ← Unicode-safe structured logging
    ├── agents/
    │   ├── strategist/      ← Phase 2.2: LangGraph graph
    │   ├── field/
    │   ├── synthesizer/
    │   ├── liaison/
    │   └── security/
    ├── schema/
    │   ├── health.py        ← HealthResponse model
    │   └── agents.py        ← AgentInfo, AgentStatusResponse
    └── routes/
        ├── health.py        ← GET /api/health
        └── agents.py        ← GET /api/agents/status
```

---

## Frontend integration

The Next.js frontend (`web/`) connects to this API at `http://localhost:8000`.
CORS is pre-configured to allow `http://localhost:3000` and `http://localhost:3001`.

To run the full stack locally:

```bash
# Terminal 1 — API
cd api && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd web && npm run dev
```

---

## Phase roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 2.1 | ✅ Done | FastAPI scaffold, health + agent-status endpoints |
| 2.2 | 🔜 Next | LangGraph agent graph wiring (one agent at a time) |
| 2.3 | 🔜 | WebSocket streaming for live agent logs |
| 2.4 | 🔜 | Authentication middleware (phone OTP) |
