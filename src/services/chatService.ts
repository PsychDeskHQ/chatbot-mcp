import type { GoogleGenAI } from "@google/genai";

import type { Settings } from "../config/index.js";
import { getGeminiModelChain } from "../config/index.js";
import type { ChatRequest, ChatResponse } from "../types/api.js";
import type { Scope } from "../types/scope.js";
import { runChat } from "./agentService.js";
import { getConversationStore } from "./conversationService.js";

export class ChatService {
  constructor(
    private readonly genaiClient: GoogleGenAI,
    private readonly settings: Settings
  ) {}

  async handleChat(req: ChatRequest): Promise<ChatResponse> {
    const scope: Scope = {
      organization_id: req.organization_id,
      therapist_id: req.therapist_id,
      client_id: req.client_id,
    };

    const store = getConversationStore();
    let conversationId: string;

    if (req.conversation_id) {
      const conversation = store.get(req.conversation_id);
      if (!conversation) {
        const err = new Error("Unknown conversation_id.");
        (err as Error & { statusCode: number }).statusCode = 404;
        throw err;
      }
      if (!store.scopeMatches(conversation, scope)) {
        const err = new Error("conversation_id does not match the provided scope.");
        (err as Error & { statusCode: number }).statusCode = 403;
        throw err;
      }
      conversationId = req.conversation_id;
    } else {
      const created = store.create(scope);
      conversationId = created.conversationId;
    }

    const conversation = store.get(conversationId)!;

    const { reply, updatedHistory } = await runChat({
      client: this.genaiClient,
      model: this.settings.GEMINI_MODEL,
      history: conversation.history,
      userMessage: req.message,
      scope,
      maxToolRounds: this.settings.MAX_TOOL_ROUNDS,
      geminiRetry: {
        models: getGeminiModelChain(this.settings),
        maxRetriesPerModel: this.settings.GEMINI_MAX_RETRIES,
        requestTimeoutMs: this.settings.GEMINI_REQUEST_TIMEOUT_MS,
      },
    });

    store.updateHistory(conversationId, updatedHistory);

    return { conversation_id: conversationId, reply };
  }
}

export class HealthService {
  constructor(private readonly settings: Settings) {}

  getHealth() {
    return { status: "ok" as const, model: this.settings.GEMINI_MODEL };
  }
}
