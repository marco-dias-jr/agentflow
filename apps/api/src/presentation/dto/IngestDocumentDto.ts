import { z } from "zod";

export const ingestDocumentSchema = z
  .object({
    title: z.string().trim().max(200).optional().default(""),
    fileName: z.string().trim().min(1, "fileName is required").max(255),
    mimeType: z.string().trim().max(120).optional().default("text/plain"),
    contentBase64: z.string().min(1).optional(),
    contentText: z.string().min(1).optional(),
    parserStrategy: z.enum(["lightweight", "strict"]).optional(),
    normalizeWhitespace: z.boolean().optional(),
    chunkStrategy: z.enum(["fixed", "paragraph", "sentence"]).optional(),
    chunkSize: z.number().int().min(100).max(4000).optional(),
    chunkOverlap: z.number().int().min(0).max(2000).optional(),
    embeddingProvider: z.enum(["auto", "gemini", "ollama", "local"]).optional(),
    embeddingModel: z.string().trim().min(1).max(120).optional(),
  })
  .refine(
    (data) => Boolean(data.contentBase64 || data.contentText),
    {
      message: "Either contentBase64 or contentText must be provided.",
    }
  );

export type IngestDocumentDto = z.infer<typeof ingestDocumentSchema>;
