import rateLimit from "express-rate-limit";

import type { Settings } from "../config/index.js";

export function createChatRateLimiter(settings: Settings) {
  return rateLimit({
    windowMs: settings.RATE_LIMIT_WINDOW_MS,
    max: settings.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      detail: "Too many requests. Please try again later.",
    },
  });
}
