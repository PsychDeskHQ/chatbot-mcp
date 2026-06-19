import { Router } from "express";

import type { ChatController } from "../controllers/chatController.js";
import { chatRequestSchema } from "../types/api.js";
import { validateRequest } from "../middleware/validateRequest.js";
import type { RateLimitRequestHandler } from "express-rate-limit";

export function createChatRoutes(
  chatController: ChatController,
  rateLimiter: RateLimitRequestHandler
): Router {
  const router = Router();
  router.post(
    "/chat",
    rateLimiter,
    validateRequest(chatRequestSchema, "body"),
    chatController.chat
  );
  return router;
}
