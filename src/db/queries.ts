/**
 * Postgres data-access layer.
 *
 * Every public function is scoped by `organization_id` AND `client_id` (the
 * clients.id UUID). Scope values come from the authenticated request, never from
 * the model, and are always bound as query parameters ($1, $2, ...).
 */

import { rowToObject, rowsToObjects } from "../utils/jsonable.js";
import { requirePool } from "./pool.js";

// --- Reads -----------------------------------------------------------------

export async function getClient(
  orgId: string,
  clientId: string
): Promise<Record<string, unknown> | null> {
  const sql = `
        SELECT id, client_id, name, email, dob, gender, pronouns, occupation,
               address, contact, country_code, emergency_contact,
               is_active, is_assessed, referred_by, metadata
        FROM clients
        WHERE id = $1 AND organization_id = $2
    `;
  const result = await requirePool().query(sql, [clientId, orgId]);
  return rowToObject(result.rows[0] as Record<string, unknown> | undefined);
}

export async function listNoteFolders(
  orgId: string,
  clientId: string
): Promise<Record<string, unknown>[]> {
  const sql = `
        SELECT id, name, description, is_favorite
        FROM client_note_folders
        WHERE client_id = $1 AND organization_id = $2
        ORDER BY name
    `;
  const result = await requirePool().query(sql, [clientId, orgId]);
  return rowsToObjects(result.rows as Record<string, unknown>[]);
}

export async function listClientNotes(
  orgId: string,
  clientId: string,
  folderId?: string | null
): Promise<Record<string, unknown>[]> {
  let sql: string;
  let args: string[];

  if (folderId) {
    sql = `
            SELECT id, title, folder_id, created_by, created_at, updated_at,
                   left(content, 280) AS content_preview
            FROM client_notes
            WHERE client_id = $1 AND organization_id = $2 AND folder_id = $3
            ORDER BY updated_at DESC NULLS LAST
        `;
    args = [clientId, orgId, folderId];
  } else {
    sql = `
            SELECT id, title, folder_id, created_by, created_at, updated_at,
                   left(content, 280) AS content_preview
            FROM client_notes
            WHERE client_id = $1 AND organization_id = $2
            ORDER BY updated_at DESC NULLS LAST
        `;
    args = [clientId, orgId];
  }

  const result = await requirePool().query(sql, args);
  return rowsToObjects(result.rows as Record<string, unknown>[]);
}

export async function getClientNote(
  orgId: string,
  clientId: string,
  noteId: string
): Promise<Record<string, unknown> | null> {
  const sql = `
        SELECT id, title, content, folder_id, created_by, created_at, updated_at
        FROM client_notes
        WHERE id = $1 AND client_id = $2 AND organization_id = $3
    `;
  const result = await requirePool().query(sql, [noteId, clientId, orgId]);
  return rowToObject(result.rows[0] as Record<string, unknown> | undefined);
}

export async function listClientWorksheets(
  orgId: string,
  clientId: string
): Promise<Record<string, unknown>[]> {
  const sql = `
        SELECT cw.id AS assignment_id, cw.worksheet_id, cw.created_at,
               cwt.title, cwt.subtitle, cwt.types
        FROM client_worksheets cw
        JOIN clients c
          ON c.id = cw.client_id AND c.organization_id = $2
        JOIN customized_worksheet_templates cwt
          ON cwt.id = cw.worksheet_id
        WHERE cw.client_id = $1
        ORDER BY cw.created_at DESC
    `;
  const result = await requirePool().query(sql, [clientId, orgId]);
  return rowsToObjects(result.rows as Record<string, unknown>[]);
}

export async function getWorksheetContent(
  orgId: string,
  clientId: string,
  worksheetId: string
): Promise<Record<string, unknown> | null> {
  const sql = `
        SELECT cwt.id, cwt.title, cwt.subtitle, cwt.types,
               cwt.introduction, cwt.details, cwt.html_content
        FROM customized_worksheet_templates cwt
        JOIN client_worksheets cw
          ON cw.worksheet_id = cwt.id AND cw.client_id = $2
        JOIN clients c
          ON c.id = cw.client_id AND c.organization_id = $3
        WHERE cwt.id = $1
        LIMIT 1
    `;
  const result = await requirePool().query(sql, [worksheetId, clientId, orgId]);
  return rowToObject(result.rows[0] as Record<string, unknown> | undefined);
}

// --- Writes ----------------------------------------------------------------

export async function updateClientNote(
  orgId: string,
  clientId: string,
  noteId: string,
  title?: string | null,
  content?: string | null
): Promise<Record<string, unknown> | null> {
  const sql = `
        UPDATE client_notes
        SET title = COALESCE($4, title),
            content = COALESCE($5, content),
            updated_at = now()
        WHERE id = $1 AND client_id = $2 AND organization_id = $3
        RETURNING id, title, content, folder_id, updated_at
    `;
  const result = await requirePool().query(sql, [
    noteId,
    clientId,
    orgId,
    title ?? null,
    content ?? null,
  ]);
  return rowToObject(result.rows[0] as Record<string, unknown> | undefined);
}
