import pg from "pg";

import { getLogger } from "../utils/logger.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export async function initPool(databaseUrl: string): Promise<void> {
  if (pool) {
    return;
  }

  pool = new Pool({
    connectionString: databaseUrl,
    min: 1,
    max: 10,
  });

  pool.on("error", (err) => {
    getLogger().error("Unexpected Postgres pool error", { error: err.message });
  });

  await pool.query("SELECT 1");
  getLogger().info("Postgres connection pool initialized");
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    getLogger().info("Postgres connection pool closed");
  }
}

export function requirePool(): pg.Pool {
  if (!pool) {
    throw new Error("DB pool is not initialized; call initPool() first");
  }
  return pool;
}

export function getPool(): pg.Pool | null {
  return pool;
}
