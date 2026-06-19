/**
 * Tool definitions + scoped dispatch.
 *
 * organization_id / client_id are injected from the request scope here,
 * so the model can never read or write data outside the client it was given.
 */

import * as db from "../db/queries.js";
import type { Scope } from "../types/scope.js";

export type ToolResult = Record<string, unknown>;

/**
 * Execute a tool call within the request scope and return a JSON-safe dict.
 * Errors are returned as { error: ... } so the model can react instead of the
 * whole turn failing.
 */
export async function dispatch(
  name: string,
  args: Record<string, unknown>,
  scope: Scope
): Promise<ToolResult> {
  const safeArgs = args ?? {};

  switch (name) {
    case "get_client_details": {
      const client = await db.getClient(scope.organization_id, scope.client_id);
      if (!client) {
        return { error: "Client not found in this organization." };
      }
      return { client };
    }

    case "list_note_folders": {
      const folders = await db.listNoteFolders(scope.organization_id, scope.client_id);
      return { folders };
    }

    case "list_client_notes": {
      const folderId =
        typeof safeArgs.folder_id === "string" ? safeArgs.folder_id : undefined;
      const notes = await db.listClientNotes(
        scope.organization_id,
        scope.client_id,
        folderId
      );
      return { notes };
    }

    case "get_client_note": {
      const noteId = safeArgs.note_id;
      if (typeof noteId !== "string" || !noteId) {
        return { error: "note_id is required." };
      }
      const note = await db.getClientNote(
        scope.organization_id,
        scope.client_id,
        noteId
      );
      if (!note) {
        return { error: "Note not found for this client." };
      }
      return { note };
    }

    case "list_client_worksheets": {
      const worksheets = await db.listClientWorksheets(
        scope.organization_id,
        scope.client_id
      );
      return { worksheets };
    }

    case "get_worksheet_content": {
      const worksheetId = safeArgs.worksheet_id;
      if (typeof worksheetId !== "string" || !worksheetId) {
        return { error: "worksheet_id is required." };
      }
      const worksheet = await db.getWorksheetContent(
        scope.organization_id,
        scope.client_id,
        worksheetId
      );
      if (!worksheet) {
        return { error: "Worksheet not found or not assigned to this client." };
      }
      return { worksheet };
    }

    case "update_client_note": {
      const noteId = safeArgs.note_id;
      const title = safeArgs.title;
      const content = safeArgs.content;

      if (typeof noteId !== "string" || !noteId) {
        return { error: "note_id is required." };
      }
      if (title === undefined && content === undefined) {
        return { error: "Provide at least one of title or content to update." };
      }

      const updated = await db.updateClientNote(
        scope.organization_id,
        scope.client_id,
        noteId,
        typeof title === "string" ? title : null,
        typeof content === "string" ? content : null
      );
      if (!updated) {
        return { error: "Note not found for this client; nothing updated." };
      }
      return { updated_note: updated };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
