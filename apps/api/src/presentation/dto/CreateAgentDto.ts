import { z } from "zod";

export const createAgentSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  description: z.string().trim().max(500).optional().default(""),
  systemPrompt: z.string().trim().min(1, "systemPrompt is required").max(8000),
  provider: z.string().trim().min(1, "provider is required").max(60),
  model: z.string().trim().min(1, "model is required").max(120),
  enabledTools: z.array(z.string().trim().min(1)).optional().default([]),
});

export type CreateAgentDto = z.infer<typeof createAgentSchema>;
