/** Make DB values JSON-serializable for the model (dates, UUIDs, etc.). */
export function jsonable(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(jsonable);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      out[k] = jsonable(v);
    }
    return out;
  }

  return value;
}

export function rowToObject(
  row: Record<string, unknown> | undefined | null
): Record<string, unknown> | null {
  if (!row) {
    return null;
  }
  return jsonable(row) as Record<string, unknown>;
}

export function rowsToObjects(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => jsonable(r) as Record<string, unknown>);
}
