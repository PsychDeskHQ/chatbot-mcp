import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import { getSettings, getCorsOrigins } from "./config/index.js";
import { createGenAIClient } from "./services/agentService.js";
import { ChatService, HealthService } from "./services/chatService.js";
import { ChatController } from "./controllers/chatController.js";
import { HealthController } from "./controllers/healthController.js";
import { createRoutes } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createChatRateLimiter } from "./middleware/rateLimiter.js";
import { requestLogger } from "./middleware/requestLogger.js";

export interface AppDependencies {
  chatService: ChatService;
  healthService: HealthService;
  chatController: ChatController;
  healthController: HealthController;
}

export function createDependencies(): AppDependencies {
  const settings = getSettings();
  const genaiClient = createGenAIClient(settings.GEMINI_API_KEY);
  const chatService = new ChatService(genaiClient, settings);
  const healthService = new HealthService(settings);
  const chatController = new ChatController(chatService);
  const healthController = new HealthController(healthService);

  return {
    chatService,
    healthService,
    chatController,
    healthController,
  };
}

export function createApp(deps: AppDependencies = createDependencies()): Express {
  const settings = getSettings();
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: getCorsOrigins(settings),
      methods: ["GET", "POST", "OPTIONS"],
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  const chatRateLimiter = createChatRateLimiter(settings);
  app.use(createRoutes(deps.healthController, deps.chatController, chatRateLimiter));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
