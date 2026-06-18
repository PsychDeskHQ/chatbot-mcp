import { z } from "zod";

/** Request body for POST /chat — mirrors the Python Pydantic ChatRequest. */
export const chatRequestSchema = z.object({
  organization_id: z.string().min(1),
  therapist_id: z.string().min(1),
  client_id: z.string().min(1),
  message: z.string().min(1),
  conversation_id: z.string().nullable().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Response body for POST /chat — mirrors the Python Pydantic ChatResponse. */
export const chatResponseSchema = z.object({
  conversation_id: z.string(),
  reply: z.string(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  model: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
