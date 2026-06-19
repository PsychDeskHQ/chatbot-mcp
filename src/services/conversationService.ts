/**
 * MVP conversation state kept in memory (a Map).
 * NOT durable and NOT multi-process safe — fine for internal testing.
 */

import { randomUUID } from "node:crypto";

import type { Content } from "@google/genai";

import type { Conversation } from "../types/conversation.js";
import type { Scope } from "../types/scope.js";
import { scopesEqual } from "../types/scope.js";

export class ConversationStore {
  private readonly conversations = new Map<string, Conversation>();

  create(scope: Scope): { conversationId: string; conversation: Conversation } {
    const conversationId = randomUUID();
    const conversation: Conversation = { scope, history: [] };
    this.conversations.set(conversationId, conversation);
    return { conversationId, conversation };
  }

  get(conversationId: string): Conversation | undefined {
    return this.conversations.get(conversationId);
  }

  updateHistory(conversationId: string, history: Content[]): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.history = history;
    }
  }

  scopeMatches(conversation: Conversation, scope: Scope): boolean {
    return scopesEqual(conversation.scope, scope);
  }
}

let store: ConversationStore | null = null;

export function getConversationStore(): ConversationStore {
  if (!store) {
    store = new ConversationStore();
  }
  return store;
}

export function resetConversationStore(): void {
  store = new ConversationStore();
}
