import type { FunctionDeclaration } from "@google/genai";

/**
 * Function declarations passed to Gemini (JSON-Schema-style parameter specs).
 * Deliberately DO NOT include organization_id / client_id.
 */
export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_client_details",
    description:
      "Get the in-scope client's profile and demographics (name, dob, gender, pronouns, contact, occupation, status, etc.).",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_note_folders",
    description: "List the note folders for the in-scope client.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_client_notes",
    description:
      "List therapy notes for the in-scope client (title + metadata + a short content preview). Optionally filter by folder_id.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        folder_id: {
          type: "string",
          description: "Optional folder UUID to filter notes by.",
        },
      },
    },
  },
  {
    name: "get_client_note",
    description: "Get the full body of one therapy note by its id.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        note_id: { type: "string", description: "The note UUID." },
      },
      required: ["note_id"],
    },
  },
  {
    name: "list_client_worksheets",
    description:
      "List worksheets assigned to the in-scope client, with each worksheet's title, subtitle and types.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_worksheet_content",
    description:
      "Get the full content (introduction, details, html_content) of one worksheet assigned to the in-scope client, by worksheet_id.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        worksheet_id: {
          type: "string",
          description: "The worksheet (customized template) UUID.",
        },
      },
      required: ["worksheet_id"],
    },
  },
  {
    name: "update_client_note",
    description:
      "Update an existing therapy note for the in-scope client. Provide note_id and at least one of title or content. Only edits notes that already exist; it cannot create or delete notes.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        note_id: { type: "string", description: "The note UUID to update." },
        title: { type: "string", description: "New title (optional)." },
        content: { type: "string", description: "New note body (optional)." },
      },
      required: ["note_id"],
    },
  },
];
