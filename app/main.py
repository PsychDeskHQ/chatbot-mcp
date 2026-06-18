"""FastAPI service exposing POST /chat.

MVP conversation state is kept in memory (a dict). It is NOT durable and NOT
multi-process safe — fine for internal testing, replace with a store before
real use. See README.
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException
from google import genai
from google.genai import types

from app import db
from app.agent import run_chat
from app.config import Settings, get_settings
from app.models import ChatRequest, ChatResponse
from app.tools import Scope


@dataclass
class Conversation:
    scope: Scope
    history: list[types.Content]


# Process-local state, populated on startup.
class _State:
    settings: Settings
    genai_client: genai.Client
    conversations: dict[str, Conversation]


state = _State()


@asynccontextmanager
async def lifespan(app: FastAPI):
    state.settings = get_settings()
    state.genai_client = genai.Client(api_key=state.settings.gemini_api_key)
    state.conversations = {}
    await db.init_pool(state.settings.database_url)
    try:
        yield
    finally:
        await db.close_pool()


app = FastAPI(title="Therapy Assistant (MVP)", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "model": state.settings.gemini_model}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    scope = Scope(
        organization_id=req.organization_id,
        therapist_id=req.therapist_id,
        client_id=req.client_id,
    )

    if req.conversation_id:
        conversation = state.conversations.get(req.conversation_id)
        if conversation is None:
            raise HTTPException(status_code=404, detail="Unknown conversation_id.")
        # A conversation is bound to its original scope; refuse scope changes so
        # one conversation can't be reused to reach another client/org.
        if conversation.scope != scope:
            raise HTTPException(
                status_code=403,
                detail="conversation_id does not match the provided scope.",
            )
        conversation_id = req.conversation_id
    else:
        conversation_id = str(uuid.uuid4())
        conversation = Conversation(scope=scope, history=[])
        state.conversations[conversation_id] = conversation

    reply, updated_history = await run_chat(
        client=state.genai_client,
        model=state.settings.gemini_model,
        history=conversation.history,
        user_message=req.message,
        scope=scope,
        max_tool_rounds=state.settings.max_tool_rounds,
    )
    conversation.history = updated_history

    return ChatResponse(conversation_id=conversation_id, reply=reply)
