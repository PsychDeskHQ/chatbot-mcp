import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { getLogger } from "../utils/logger.js";
import { AppError, getStatusCode } from "../utils/errors.js";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ detail: "Not Found" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const logger = getLogger();

  if (err instanceof ZodError) {
    res.status(422).json({
      detail: "Validation error",
      errors: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  const statusCode = getStatusCode(err);
  const message =
    err instanceof Error ? err.message : "An unexpected error occurred";

  if (statusCode >= 500) {
    logger.error("Unhandled server error", {
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
  } else {
    logger.warn("Client error", { statusCode, error: message });
  }

  const body: Record<string, unknown> = { detail: message };
  if (err instanceof AppError && err.details !== undefined) {
    body.errors = err.details;
  }

  res.status(statusCode).json(body);
}
