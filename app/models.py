"""Request/response models for the /chat endpoint."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    # Authenticated request scope. In this MVP the caller is trusted to supply
    # these honestly (internal service). See README "Auth" for hardening.
    organization_id: str = Field(..., description="Caller's organization UUID.")
    therapist_id: str = Field(..., description="Caller's therapist UUID.")
    client_id: str = Field(..., description="In-scope client's UUID (clients.id).")

    message: str = Field(..., min_length=1, description="The user's message.")
    conversation_id: Optional[str] = Field(
        None, description="Omit to start a new conversation; pass to continue one."
    )


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
