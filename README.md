# chatbot-pawan — Therapy Assistant (MVP)

A small, guardrailed chatbot for an internal therapy practice-management
platform. A therapist (or an internal service acting for one) chats about **one
specific client**: the assistant can look up the client's profile, read their
therapy notes and assigned worksheets, and **update an existing note**.

Built with **Node.js 22+**, **TypeScript**, **Express**, and the **Gemini API**
with a manual tool-use loop. Talks **directly to Postgres**. This is an MVP
intended for internal use — see [Limitations & next steps](#limitations--next-steps).

---

## What it does

- **Reads** (scoped to one client): client profile/demographics, note folders,
  therapy notes (list + full body), assigned worksheets (list + full content).
- **Writes**: updates an existing therapy note's title/content. It **cannot**
  create or delete notes.
- **Two guardrails**:
  1. **Topic guardrail** (system prompt): only answers questions about the
     platform and the in-scope client; politely declines anything else.
  2. **Data-scope guardrail** (code, the real protection): every DB query is
     filtered by `organization_id` + `client_id` taken from the request, never
     from the model. Notes/worksheets the model references are verified to
     belong to the in-scope client before any read or update.

---

## Architecture

```
POST /chat                    agentService.ts             tools/dispatch.ts   db/queries.ts
  │  organization_id           Gemini tool-use loop  ──► scoped dispatch ──► parameterized
  │  therapist_id        ────► (@google/genai)            (injects scope)     SQL on Postgres
  │  client_id                 + topic-guardrail system
  │  message                   prompt
  └─ conversation_id?
```

The model only ever sees tool schemas **without** `organization_id`/`client_id`.
Those are injected from the request `Scope`, so the model physically cannot
reach another client or org.

### File layout

| Path | Responsibility |
|------|----------------|
| `src/index.ts` | Server bootstrap, DB pool lifecycle |
| `src/app.ts` | Express app, middleware, DI wiring |
| `src/config/` | Env validation (Zod) |
| `src/types/` | Zod schemas + shared types |
| `src/db/` | `pg` pool + scoped SQL queries |
| `src/tools/` | Gemini tool declarations + dispatch |
| `src/services/agentService.ts` | System prompt + tool-use loop |
| `src/services/conversationService.ts` | In-memory conversation store |
| `src/services/chatService.ts` | `/chat` business logic |
| `src/controllers/` | HTTP handlers |
| `src/routes/` | Route definitions |
| `src/middleware/` | Validation, errors, rate limit, logging |
| `sql/schema.sql` | Postgres schema |
| `sql/seed.sql` | Sample data for local testing |

---

## Data model & access scope

The assistant reads these tables and updates only `client_notes`:

| Table | Access | Scope |
|-------|--------|-------|
| `clients` | read | `id = client_id AND organization_id` |
| `client_notes` | read + **update** | `client_id AND organization_id` |
| `client_note_folders` | read | `client_id AND organization_id` |
| `client_worksheets` | read | `client_id` (org enforced via join on `clients`) |
| `customized_worksheet_templates` | read | reachable only via `client_worksheets` for the client |

> **`client_id` means `clients.id` (the UUID primary key)** — the foreign key
> used across the child tables — **not** the human-readable `clients.client_id`
> text column. The request's `client_id` field must be that UUID.

### Tools exposed to the model

| Tool | Args (model-facing) | Action |
|------|---------------------|--------|
| `get_client_details` | — | client profile |
| `list_note_folders` | — | folders for the client |
| `list_client_notes` | `folder_id?` | notes (metadata + preview) |
| `get_client_note` | `note_id` | full note body |
| `list_client_worksheets` | — | assigned worksheets |
| `get_worksheet_content` | `worksheet_id` | full worksheet content |
| `update_client_note` | `note_id`, `title?`, `content?` | edit an existing note |

---

## Setup

Requires **Node.js 22+**, Postgres, and a Gemini API key.

```bash
nvm use                 # optional, see .nvmrc
npm install
cp .env.example .env    # set GEMINI_API_KEY and DATABASE_URL
psql "$DATABASE_URL" -f sql/schema.sql
psql "$DATABASE_URL" -f sql/seed.sql   # optional sample data
npm run dev             # http://127.0.0.1:8000
```

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development with hot reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run production build |
| `npm run typecheck` | Type-check only |

Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

### Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 22+, TypeScript |
| HTTP | Express.js |
| Validation | Zod |
| Database | PostgreSQL + `pg` pool |
| AI | `@google/genai` (Gemini) |
| Config | dotenv + Zod |
| Logging | Winston |
| Security | Helmet, CORS, rate limiting |

### Configuration (env vars)

| Var | Required | Default | Notes |
|-----|----------|---------|-------|
| `GEMINI_API_KEY` | ✅ | — | Gemini API key. |
| `DATABASE_URL` | ✅ | — | Postgres DSN (`postgresql://user:pass@host:5432/db`). |
| `GEMINI_MODEL` | — | `gemini-3.5-flash` | Any current Gemini model id. |
| `MAX_TOOL_ROUNDS` | — | `8` | Loop guard: max tool rounds per message. |
| `HOST` / `PORT` | — | `127.0.0.1` / `8000` | Server bind. |
| `NODE_ENV` | — | `development` | Environment. |
| `CORS_ORIGIN` | — | `*` | Comma-separated origins. |
| `RATE_LIMIT_WINDOW_MS` | — | `60000` | Rate limit window. |
| `RATE_LIMIT_MAX` | — | `60` | Max requests per window on `/chat`. |
| `LOG_LEVEL` | — | `info` | Winston log level. |

---

## API

### `GET /health`
```json
{ "status": "ok", "model": "gemini-3.5-flash" }
```

### `POST /chat`

Request:
```json
{
  "organization_id": "11111111-1111-1111-1111-111111111111",
  "therapist_id":   "22222222-2222-2222-2222-222222222222",
  "client_id":      "33333333-3333-3333-3333-333333333333",
  "message": "Summarize the most recent session note for this client.",
  "conversation_id": null
}
```

Response:
```json
{
  "conversation_id": "9f1c…",
  "reply": "The most recent note (2026-06-10) covers …"
}
```

Pass the returned `conversation_id` on the next call to continue the same
conversation. A conversation is bound to the scope it started with: calling it
with a different `organization_id`/`therapist_id`/`client_id` is rejected (403).

Example:
```bash
curl -s http://127.0.0.1:8000/chat \
  -H 'content-type: application/json' \
  -d '{
    "organization_id": "…",
    "therapist_id": "…",
    "client_id": "…",
    "message": "What worksheets are assigned to this client?"
  }'
```

---

## How the model gets data (request flow)

1. `/chat` builds a `Scope(organization_id, therapist_id, client_id)` from the
   request body.
2. `runChat` sends the message + history to Gemini with the tool schemas and
   the guardrail system prompt.
3. If Gemini requests tools, `dispatch()` runs each one **with the scope
   injected**, returns JSON-safe results, and feeds them back (echoing each
   call's `id`, as Gemini 3 requires).
4. The loop repeats until Gemini returns a final text answer (or hits
   `MAX_TOOL_ROUNDS`).

---

## Limitations & next steps

This is an MVP. Known gaps, roughly in priority order:

- **Auth.** `/chat` trusts the caller to send `organization_id` / `therapist_id`
  / `client_id` honestly. Before exposing it beyond a trusted internal caller,
  derive these from an authenticated token instead of the request body.
- **Conversation storage is in-memory.** State lives in a process-local store —
  not durable, lost on restart, not shared across workers. Move to Redis/Postgres
  for anything real.
- **No streaming.** Replies are returned whole. Streaming `generateContent` is
  a straightforward upgrade.
- **Topic guardrail is prompt-based.** Good enough internally; add an explicit
  classifier/validation step if stronger enforcement is needed.
- **Notes are update-only by design.** Create/delete were intentionally left out
  for the MVP; add tools + DB functions when needed.
- **No tests yet.** Add integration tests before scaling.
- **PHI:** request/response bodies are not logged by the app. Keep it that way,
  and review retention/compliance before production.
