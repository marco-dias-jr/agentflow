import { z } from "zod";

export const updateAgentSchema = z
  .object({
    name: z.string().trim().min(1, "name cannot be empty").max(120).optional(),
    description: z.string().trim().max(500).optional(),
    systemPrompt: z
      .string()
      .trim()
      .min(1, "systemPrompt cannot be empty")
      .max(8000)
      .optional(),
    provider: z
      .string()
      .trim()
      .min(1, "provider cannot be empty")
      .max(60)
      .optional(),
    model: z.string().trim().min(1, "model cannot be empty").max(120).optional(),
    enabledTools: z.array(z.string().trim().min(1)).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type UpdateAgentDto = z.infer<typeof updateAgentSchema>;
