import { Router } from "express";

import type { ChatController } from "../controllers/chatController.js";
import type { HealthController } from "../controllers/healthController.js";
import { createChatRoutes } from "./chatRoutes.js";
import { createHealthRoutes } from "./healthRoutes.js";
import type { RateLimitRequestHandler } from "express-rate-limit";

export function createRoutes(
  healthController: HealthController,
  chatController: ChatController,
  chatRateLimiter: RateLimitRequestHandler
): Router {
  const router = Router();
  router.use(createHealthRoutes(healthController));
  router.use(createChatRoutes(chatController, chatRateLimiter));
  return router;
}
