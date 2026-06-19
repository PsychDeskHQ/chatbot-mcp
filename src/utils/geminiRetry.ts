import type { Content, GenerateContentConfig, GoogleGenAI } from "@google/genai";

import { AppError } from "./errors.js";
import { getLogger } from "./logger.js";

export interface GeminiRetryOptions {
  /** Primary model first, then fallbacks. */
  models: string[];
  maxRetriesPerModel?: number;
  initialWaitMs?: number;
  maxWaitMs?: number;
  requestTimeoutMs?: number;
}

interface ParsedGeminiError {
  code?: number;
  message: string;
  status?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number, initialMs: number, maxMs: number): number {
  const exponential = Math.min(initialMs * 2 ** attempt, maxMs);
  return exponential + Math.random() * 1000;
}

/** Parse Gemini SDK / API errors (JSON string or nested object). */
export function parseGeminiError(err: unknown): ParsedGeminiError | null {
  if (!(err instanceof Error)) {
    return null;
  }

  const raw = err.message.trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: number; message?: string; status?: string };
    };
    if (parsed.error) {
      return {
        code: parsed.error.code,
        message: parsed.error.message ?? raw,
        status: parsed.error.status,
      };
    }
  } catch {
    // Not JSON — fall through.
  }

  const codeMatch = raw.match(/\b(503|429|500|401|400)\b/);
  return {
    code: codeMatch ? Number(codeMatch[1]) : undefined,
    message: raw,
  };
}

function isRetryableCode(code?: number): boolean {
  return code === 503 || code === 429 || code === 500;
}

function retryWaitMs(code: number | undefined, attempt: number, initialMs: number, maxMs: number): number {
  if (code === 429) {
    return 60_000 + Math.random() * 10_000;
  }
  return backoffDelay(attempt, initialMs, maxMs);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Gemini request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function uniqueModels(models: string[]): string[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = model.trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildModelChain(primary: string, fallbacks: string[]): string[] {
  return uniqueModels([primary, ...fallbacks]);
}

/**
 * Call Gemini with exponential backoff per model, then fall back to the next model.
 * Handles 503 (high demand), 429 (rate limit), 500, and timeouts.
 */
export async function generateContentWithRetry(
  client: GoogleGenAI,
  params: {
    model: string;
    contents: Content[];
    config: GenerateContentConfig;
  },
  options: GeminiRetryOptions
) {
  const logger = getLogger();
  const models = uniqueModels(options.models.length > 0 ? options.models : [params.model]);
  const maxRetriesPerModel = options.maxRetriesPerModel ?? 3;
  const initialWaitMs = options.initialWaitMs ?? 2000;
  const maxWaitMs = options.maxWaitMs ?? 32_000;
  const requestTimeoutMs = options.requestTimeoutMs ?? 30_000;

  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < maxRetriesPerModel; attempt++) {
      try {
        const response = await withTimeout(
          client.models.generateContent({
            model,
            contents: params.contents,
            config: params.config,
          }),
          requestTimeoutMs
        );

        if (model !== models[0]) {
          logger.warn("Gemini model fallback succeeded", {
            primaryModel: models[0],
            modelUsed: model,
          });
        }

        return { response, modelUsed: model };
      } catch (err: unknown) {
        lastError = err;
        const parsed = parseGeminiError(err);
        const code = parsed?.code;
        const message = parsed?.message ?? (err instanceof Error ? err.message : String(err));
        const isTimeout = message.toLowerCase().includes("timed out");

        if (isTimeout) {
          logger.warn("Gemini request timed out, trying next model", { model, attempt: attempt + 1 });
          break;
        }

        if (!isRetryableCode(code)) {
          throw err;
        }

        const isLastAttempt = attempt >= maxRetriesPerModel - 1;
        if (isLastAttempt) {
          logger.warn("Gemini model exhausted retries, trying fallback", {
            model,
            code,
            message,
          });
          break;
        }

        const waitMs = retryWaitMs(code, attempt, initialWaitMs, maxWaitMs);
        logger.warn("Gemini transient error, retrying with backoff", {
          model,
          code,
          attempt: attempt + 1,
          maxRetries: maxRetriesPerModel,
          waitMs: Math.round(waitMs),
        });
        await sleep(waitMs);
      }
    }
  }

  const parsed = parseGeminiError(lastError);
  const code = parsed?.code ?? 503;

  if (code === 429) {
    throw new AppError(
      "Gemini rate limit reached. Please wait a minute and try again.",
      429,
      { retryable: true, gemini: parsed }
    );
  }

  throw new AppError(
    "Gemini is temporarily unavailable due to high demand. Please try again in a few minutes.",
    503,
    { retryable: true, gemini: parsed }
  );
}
