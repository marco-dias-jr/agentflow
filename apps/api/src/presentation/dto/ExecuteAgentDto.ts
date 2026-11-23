import { z } from "zod";

export const executeAgentSchema = z.object({
  prompt: z.string().trim().min(1, "prompt is required").max(8000),
  maxToolIterations: z.number().int().min(1).max(5).optional().default(3),
});

export type ExecuteAgentDto = z.infer<typeof executeAgentSchema>;
