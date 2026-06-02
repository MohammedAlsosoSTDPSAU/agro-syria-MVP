"""Central application settings — loaded once at startup."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve once at import time: api/.env — works regardless of cwd
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
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

    # OpenAI
    openai_api_key: str = Field(default="")
    openai_model: str = "gpt-4o-mini"   # faster + cheaper for demo; override in .env
    openai_timeout: int = 25             # seconds — falls back to local synthesis on timeout

    # LangChain / LangSmith tracing (optional)
    langchain_tracing_v2: bool = False
    langchain_api_key: str = Field(default="")
    langchain_project: str = "agro-syria"

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
