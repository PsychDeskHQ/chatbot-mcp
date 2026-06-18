import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
export const DEFAULT_GEMINI_FALLBACK_MODELS = "gemini-2.5-flash,gemini-2.0-flash";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required (see .env.example)"),
  GEMINI_MODEL: z.string().default(DEFAULT_GEMINI_MODEL),
  GEMINI_FALLBACK_MODELS: z.string().default(DEFAULT_GEMINI_FALLBACK_MODELS),
  GEMINI_MAX_RETRIES: z.coerce.number().int().positive().max(10).default(3),
  GEMINI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see .env.example)"),
  MAX_TOOL_ROUNDS: z.coerce.number().int().positive().default(8),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(8000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("*"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

export type Settings = z.infer<typeof envSchema>;

let cachedSettings: Settings | null = null;

/** Read and validate config. Throws if a required value is missing. */
export function getSettings(): Settings {
  if (cachedSettings) {
    return cachedSettings;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join("; ");
    throw new Error(message);
  }

  cachedSettings = parsed.data;
  return cachedSettings;
}

/** Reset cached settings (useful in tests). */
export function resetSettingsCache(): void {
  cachedSettings = null;
}

export function getCorsOrigins(settings: Settings): string | string[] {
  if (settings.CORS_ORIGIN === "*") {
    return "*";
  }
  return settings.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
}

export function getGeminiModelChain(settings: Settings): string[] {
  const fallbacks = settings.GEMINI_FALLBACK_MODELS.split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [settings.GEMINI_MODEL, ...fallbacks].filter(
    (model, index, all) => all.indexOf(model) === index
  );
}
