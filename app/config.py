"""Application settings, loaded from the environment (.env supported)."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

# Default to the latest GA agentic model. Override with GEMINI_MODEL if needed.
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash"


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    gemini_model: str
    database_url: str
    # Hard cap on tool-call rounds per user message (guards against loops).
    max_tool_rounds: int


def get_settings() -> Settings:
    """Read + validate config. Raises if a required value is missing."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set (see .env.example)")

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set (see .env.example)")

    return Settings(
        gemini_api_key=api_key,
        gemini_model=os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL),
        database_url=database_url,
        max_tool_rounds=int(os.getenv("MAX_TOOL_ROUNDS", "8")),
    )
