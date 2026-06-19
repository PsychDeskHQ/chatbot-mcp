import type { Request, Response, NextFunction } from "express";

import { getLogger } from "../utils/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const logger = getLogger();
  const start = Date.now();

  res.on("finish", () => {
    // Do not log request/response bodies — may contain PHI.
    logger.info("HTTP request", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}
