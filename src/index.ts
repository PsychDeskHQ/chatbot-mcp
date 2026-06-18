import { createApp } from "./app.js";
import { getSettings } from "./config/index.js";
import { closePool, initPool } from "./db/pool.js";
import { getLogger } from "./utils/logger.js";

async function main(): Promise<void> {
  const settings = getSettings();
  const logger = getLogger();

  await initPool(settings.DATABASE_URL);

  const app = createApp();
  const server = app.listen(settings.PORT, settings.HOST, () => {
    logger.info("Therapy Assistant (MVP) listening", {
      host: settings.HOST,
      port: settings.PORT,
      model: settings.GEMINI_MODEL,
      env: settings.NODE_ENV,
    });
  });

  const shutdown = async (signal: string) => {
    logger.info("Shutting down", { signal });
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  getLogger().error("Fatal startup error", { error: message });
  process.exit(1);
});
