"""Postgres data-access layer.

Every public function is scoped by `organization_id` AND `client_id` (the
clients.id UUID). Scope values come from the authenticated request, never from
the model, and are always bound as query parameters ($1, $2, ...). This is the
real guardrail that protects PHI — the topic guardrail in the system prompt is
secondary.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

import asyncpg

_pool: Optional[asyncpg.Pool] = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Decode json/jsonb columns into Python objects instead of raw strings."""
    for typename in ("json", "jsonb"):
        await conn.set_type_codec(
            typename,
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
        )


async def init_pool(database_url: str) -> None:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=database_url,
            min_size=1,
            max_size=10,
            init=_init_connection,
        )


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def _require_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool is not initialized; call init_pool() first")
    return _pool


def _jsonable(value: Any) -> Any:
    """Make DB values JSON-serializable for the model (dates, UUIDs, etc.)."""
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Decimal):
        return float(value)
    return value


def _row(record: Optional[asyncpg.Record]) -> Optional[dict[str, Any]]:
    return _jsonable(dict(record)) if record is not None else None


def _rows(records: list[asyncpg.Record]) -> list[dict[str, Any]]:
    return [_jsonable(dict(r)) for r in records]


# --- Reads -----------------------------------------------------------------

async def get_client(org_id: str, client_id: str) -> Optional[dict[str, Any]]:
    sql = """
        SELECT id, client_id, name, email, dob, gender, pronouns, occupation,
               address, contact, country_code, emergency_contact,
               is_active, is_assessed, referred_by, metadata
        FROM clients
        WHERE id = $1 AND organization_id = $2
    """
    async with _require_pool().acquire() as conn:
        return _row(await conn.fetchrow(sql, client_id, org_id))


async def list_note_folders(org_id: str, client_id: str) -> list[dict[str, Any]]:
    sql = """
        SELECT id, name, description, is_favorite
        FROM client_note_folders
        WHERE client_id = $1 AND organization_id = $2
        ORDER BY name
    """
    async with _require_pool().acquire() as conn:
        return _rows(await conn.fetch(sql, client_id, org_id))


async def list_client_notes(
    org_id: str, client_id: str, folder_id: Optional[str] = None
) -> list[dict[str, Any]]:
    # A content preview keeps the list cheap; the model can fetch full bodies
    # on demand via get_client_note.
    if folder_id:
        sql = """
            SELECT id, title, folder_id, created_by, created_at, updated_at,
                   left(content, 280) AS content_preview
            FROM client_notes
            WHERE client_id = $1 AND organization_id = $2 AND folder_id = $3
            ORDER BY updated_at DESC NULLS LAST
        """
        args = (client_id, org_id, folder_id)
    else:
        sql = """
            SELECT id, title, folder_id, created_by, created_at, updated_at,
                   left(content, 280) AS content_preview
            FROM client_notes
            WHERE client_id = $1 AND organization_id = $2
            ORDER BY updated_at DESC NULLS LAST
        """
        args = (client_id, org_id)
    async with _require_pool().acquire() as conn:
        return _rows(await conn.fetch(sql, *args))


async def get_client_note(
    org_id: str, client_id: str, note_id: str
) -> Optional[dict[str, Any]]:
    sql = """
        SELECT id, title, content, folder_id, created_by, created_at, updated_at
        FROM client_notes
        WHERE id = $1 AND client_id = $2 AND organization_id = $3
    """
    async with _require_pool().acquire() as conn:
        return _row(await conn.fetchrow(sql, note_id, client_id, org_id))


async def list_client_worksheets(
    org_id: str, client_id: str
) -> list[dict[str, Any]]:
    # client_worksheets has no organization_id, so we enforce the org via a
    # join on clients. worksheet_id points at the customized template.
    sql = """
        SELECT cw.id AS assignment_id, cw.worksheet_id, cw.created_at,
               cwt.title, cwt.subtitle, cwt.types
        FROM client_worksheets cw
        JOIN clients c
          ON c.id = cw.client_id AND c.organization_id = $2
        JOIN customized_worksheet_templates cwt
          ON cwt.id = cw.worksheet_id
        WHERE cw.client_id = $1
        ORDER BY cw.created_at DESC
    """
    async with _require_pool().acquire() as conn:
        return _rows(await conn.fetch(sql, client_id, org_id))


async def get_worksheet_content(
    org_id: str, client_id: str, worksheet_id: str
) -> Optional[dict[str, Any]]:
    # Only return the worksheet if it is actually assigned to this in-scope
    # client (verified through client_worksheets + clients/org).
    sql = """
        SELECT cwt.id, cwt.title, cwt.subtitle, cwt.types,
               cwt.introduction, cwt.details, cwt.html_content
        FROM customized_worksheet_templates cwt
        JOIN client_worksheets cw
          ON cw.worksheet_id = cwt.id AND cw.client_id = $2
        JOIN clients c
          ON c.id = cw.client_id AND c.organization_id = $3
        WHERE cwt.id = $1
        LIMIT 1
    """
    async with _require_pool().acquire() as conn:
        return _row(await conn.fetchrow(sql, worksheet_id, client_id, org_id))


# --- Writes ----------------------------------------------------------------

async def update_client_note(
    org_id: str,
    client_id: str,
    note_id: str,
    title: Optional[str] = None,
    content: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Update an existing note in scope. Returns the updated row, or None if no
    matching note exists for this org+client (i.e. nothing was changed)."""
    sql = """
        UPDATE client_notes
        SET title = COALESCE($4, title),
            content = COALESCE($5, content),
            updated_at = now()
        WHERE id = $1 AND client_id = $2 AND organization_id = $3
        RETURNING id, title, content, folder_id, updated_at
    """
    async with _require_pool().acquire() as conn:
        return _row(
            await conn.fetchrow(sql, note_id, client_id, org_id, title, content)
        )
