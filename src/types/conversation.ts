import type { Content } from "@google/genai";

import type { Scope } from "./scope.js";

export interface Conversation {
  scope: Scope;
  history: Content[];
}
