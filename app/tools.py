"""Tool definitions + scoped dispatch.

The tool schemas exposed to Gemini deliberately DO NOT include
organization_id / client_id. Those come from the request scope and are
injected here, so the model can never read or write data outside the client
it was given.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app import db


@dataclass(frozen=True)
class Scope:
    """Authenticated request context — the data boundary for one /chat call."""

    organization_id: str
    therapist_id: str
    client_id: str  # clients.id (UUID) of the in-scope client


# Function declarations passed to Gemini (JSON-Schema-style parameter specs).
TOOL_DECLARATIONS: list[dict[str, Any]] = [
    {
        "name": "get_client_details",
        "description": (
            "Get the in-scope client's profile and demographics (name, dob, "
            "gender, pronouns, contact, occupation, status, etc.)."
        ),
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "list_note_folders",
        "description": "List the note folders for the in-scope client.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "list_client_notes",
        "description": (
            "List therapy notes for the in-scope client (title + metadata + a "
            "short content preview). Optionally filter by folder_id."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "folder_id": {
                    "type": "string",
                    "description": "Optional folder UUID to filter notes by.",
                }
            },
        },
    },
    {
        "name": "get_client_note",
        "description": "Get the full body of one therapy note by its id.",
        "parameters": {
            "type": "object",
            "properties": {
                "note_id": {"type": "string", "description": "The note UUID."}
            },
            "required": ["note_id"],
        },
    },
    {
        "name": "list_client_worksheets",
        "description": (
            "List worksheets assigned to the in-scope client, with each "
            "worksheet's title, subtitle and types."
        ),
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_worksheet_content",
        "description": (
            "Get the full content (introduction, details, html_content) of one "
            "worksheet assigned to the in-scope client, by worksheet_id."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "worksheet_id": {
                    "type": "string",
                    "description": "The worksheet (customized template) UUID.",
                }
            },
            "required": ["worksheet_id"],
        },
    },
    {
        "name": "update_client_note",
        "description": (
            "Update an existing therapy note for the in-scope client. Provide "
            "note_id and at least one of title or content. Only edits notes "
            "that already exist; it cannot create or delete notes."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "note_id": {"type": "string", "description": "The note UUID to update."},
                "title": {"type": "string", "description": "New title (optional)."},
                "content": {"type": "string", "description": "New note body (optional)."},
            },
            "required": ["note_id"],
        },
    },
]


async def dispatch(name: str, args: dict[str, Any], scope: Scope) -> dict[str, Any]:
    """Execute a tool call within the request scope and return a JSON-safe dict.

    Errors are returned as {"error": ...} so the model can react instead of the
    whole turn failing.
    """
    args = args or {}

    if name == "get_client_details":
        client = await db.get_client(scope.organization_id, scope.client_id)
        if client is None:
            return {"error": "Client not found in this organization."}
        return {"client": client}

    if name == "list_note_folders":
        return {"folders": await db.list_note_folders(scope.organization_id, scope.client_id)}

    if name == "list_client_notes":
        notes = await db.list_client_notes(
            scope.organization_id, scope.client_id, args.get("folder_id")
        )
        return {"notes": notes}

    if name == "get_client_note":
        note_id = args.get("note_id")
        if not note_id:
            return {"error": "note_id is required."}
        note = await db.get_client_note(scope.organization_id, scope.client_id, note_id)
        if note is None:
            return {"error": "Note not found for this client."}
        return {"note": note}

    if name == "list_client_worksheets":
        return {
            "worksheets": await db.list_client_worksheets(
                scope.organization_id, scope.client_id
            )
        }

    if name == "get_worksheet_content":
        worksheet_id = args.get("worksheet_id")
        if not worksheet_id:
            return {"error": "worksheet_id is required."}
        worksheet = await db.get_worksheet_content(
            scope.organization_id, scope.client_id, worksheet_id
        )
        if worksheet is None:
            return {"error": "Worksheet not found or not assigned to this client."}
        return {"worksheet": worksheet}

    if name == "update_client_note":
        note_id = args.get("note_id")
        title = args.get("title")
        content = args.get("content")
        if not note_id:
            return {"error": "note_id is required."}
        if title is None and content is None:
            return {"error": "Provide at least one of title or content to update."}
        updated = await db.update_client_note(
            scope.organization_id, scope.client_id, note_id, title=title, content=content
        )
        if updated is None:
            return {"error": "Note not found for this client; nothing updated."}
        return {"updated_note": updated}

    return {"error": f"Unknown tool: {name}"}
