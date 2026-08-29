"""Central application settings — loaded once at startup."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve once at import time — works regardless of cwd. Both ".env" and
# ".env.local" are loaded (the latter overrides), so a Gemini key dropped in
# either file is picked up. Real process env vars still take highest priority.
_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILES = (_ROOT / ".env", _ROOT / ".env.local")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App identity
    app_env: Literal["development", "staging", "production"] = "development"
    app_version: str = "0.1.0-demo"
    app_name: str = "Agro-Syria AI"
    app_name_ar: str = "أغرو-سيريا للذكاء الاصطناعي"

    # Security
    secret_key: str = Field(default="dev-secret-change-in-production")

    # CORS — accepts both comma-separated strings and JSON arrays from .env
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:3001"]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, v: object) -> object:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    # ── LLM providers ────────────────────────────────────────────────
    # Groq is the primary provider (matches the Next.js frontend's direct Groq
    # integration). Reached through its OpenAI-compatible endpoint, same as
    # Gemini/OpenAI below, so every call site (synthesizer, vision, startup
    # probe) is provider-agnostic.
    groq_api_key: str = Field(default="", validation_alias=AliasChoices("GROQ_API_KEY"))
    groq_model: str = "openai/gpt-oss-120b"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    # Gemini (Google AI) — secondary provider if no Groq key is configured.
    # Reached through Google's OpenAI-compatible endpoint. Reads GEMINI_API_KEY
    # first, then GOOGLE_API_KEY / GOOGLE_GEMINI_API_KEY.
    gemini_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GEMINI_API_KEY"),
    )
    gemini_model: str = "gemini-2.0-flash"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/"

    # OpenAI (last-resort fallback if neither Groq nor Gemini is configured)
    openai_api_key: str = Field(default="")
    openai_model: str = "gpt-4o-mini"   # faster + cheaper for demo; override in .env
    openai_timeout: int = 25             # seconds — falls back to local synthesis on timeout

    # LangChain / LangSmith tracing (optional)
    langchain_tracing_v2: bool = False
    langchain_api_key: str = Field(default="")
    langchain_project: str = "agro-syria"

    # ── Unified LLM accessors (provider-agnostic call sites) ─────────
    @property
    def llm_provider(self) -> str:
        """Active provider: 'groq' (preferred) → 'gemini' → 'openai' → 'none'."""
        if self.groq_api_key:
            return "groq"
        if self.gemini_api_key:
            return "gemini"
        if self.openai_api_key:
            return "openai"
        return "none"

    @property
    def llm_api_key(self) -> str:
        return self.groq_api_key or self.gemini_api_key or self.openai_api_key

    @property
    def llm_model(self) -> str:
        if self.groq_api_key:
            return self.groq_model
        return self.gemini_model if self.gemini_api_key else self.openai_model

    @property
    def llm_base_url(self) -> str | None:
        """OpenAI-compatible base URL for Groq/Gemini; ``None`` for native OpenAI."""
        if self.groq_api_key:
            return self.groq_base_url
        return self.gemini_base_url if self.gemini_api_key else None

    @property
    def is_dev(self) -> bool:
        return self.app_env == "development"

    @property
    def is_prod(self) -> bool:
        return self.app_env == "production"

    @property
    def tracing_enabled(self) -> bool:
        return self.langchain_tracing_v2 and bool(self.langchain_api_key)


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
