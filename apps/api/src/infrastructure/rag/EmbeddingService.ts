import {
  EmbeddingOptions,
  EmbeddingProvider,
  EmbeddingResult,
  ResolvedEmbeddingConfig,
} from "../../application/ports/EmbeddingProvider";

const LOCAL_MODEL_NAME = "local-hash-128";

export class EmbeddingService implements EmbeddingProvider {
  public resolveConfig(options?: EmbeddingOptions): ResolvedEmbeddingConfig {
    const requestedProvider = options?.provider ?? "auto";
    const requestedModel = options?.model?.trim();
    const geminiKey = (process.env.GEMINI_API_KEY ?? "").trim();
    const ollamaUrl = (process.env.OLLAMA_BASE_URL ?? "").trim();
    const envProvider = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase();

    if (requestedProvider === "local") {
      return {
        provider: "local",
        model: requestedModel || LOCAL_MODEL_NAME,
      };
    }

    if (requestedProvider === "gemini") {
      if (!geminiKey) {
        return {
          provider: "local",
          model: LOCAL_MODEL_NAME,
        };
      }
      return {
        provider: "gemini",
        model:
          requestedModel ||
          (process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001").trim(),
      };
    }

    if (requestedProvider === "ollama") {
      if (!ollamaUrl) {
        return {
          provider: "local",
          model: LOCAL_MODEL_NAME,
        };
      }
      return {
        provider: "ollama",
        model:
          requestedModel ||
          (process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text").trim(),
      };
    }

    // "auto" resolution based on configured environment
    if (geminiKey && envProvider !== "ollama") {
      return {
        provider: "gemini",
        model:
          requestedModel ||
          (process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001").trim(),
      };
    }

    if (ollamaUrl && envProvider === "ollama") {
      return {
        provider: "ollama",
        model:
          requestedModel ||
          (process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text").trim(),
      };
    }

    return {
      provider: "local",
      model: LOCAL_MODEL_NAME,
    };
  }

  public async embedTexts(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<number[][]> {
    const result = await this.embedTextsWithMetadata(texts, options);
    return result.embeddings;
  }

  public async embedTextsWithMetadata(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult> {
    const resolved = this.resolveConfig(options);

    if (texts.length === 0) {
      return {
        embeddings: [],
        provider: resolved.provider,
        model: resolved.model,
      };
    }

    if (resolved.provider === "gemini") {
      const geminiKey = (process.env.GEMINI_API_KEY ?? "").trim();
      if (geminiKey) {
        try {
          const embeddings = await this.embedWithGemini(
            texts,
            geminiKey,
            resolved.model
          );
          return {
            embeddings,
            provider: "gemini",
            model: resolved.model,
          };
        } catch {
          return {
            embeddings: texts.map((t) => this.localFallbackEmbedding(t)),
            provider: "local",
            model: LOCAL_MODEL_NAME,
          };
        }
      }
    }

    if (resolved.provider === "ollama") {
      const ollamaUrl = (process.env.OLLAMA_BASE_URL ?? "").trim();
      if (ollamaUrl) {
        try {
          const embeddings = await this.embedWithOllama(
            texts,
            ollamaUrl,
            resolved.model
          );
          return {
            embeddings,
            provider: "ollama",
            model: resolved.model,
          };
        } catch {
          return {
            embeddings: texts.map((t) => this.localFallbackEmbedding(t)),
            provider: "local",
            model: LOCAL_MODEL_NAME,
          };
        }
      }
    }

    return {
      embeddings: texts.map((t) => this.localFallbackEmbedding(t)),
      provider: "local",
      model: LOCAL_MODEL_NAME,
    };
  }

  private async embedWithGemini(
    texts: string[],
    apiKey: string,
    model: string
  ): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
        }),
      });
      if (!res.ok) {
        throw new Error(`Gemini embedding failed (${res.status})`);
      }
      const data = (await res.json()) as {
        embedding?: { values?: number[] };
      };
      if (!data.embedding?.values?.length) {
        throw new Error("Empty embedding returned by Gemini");
      }
      results.push(data.embedding.values);
    }

    return results;
  }

  private async embedWithOllama(
    texts: string[],
    baseUrl: string,
    model: string
  ): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
      });
      if (!res.ok) {
        throw new Error(`Ollama embedding failed (${res.status})`);
      }
      const data = (await res.json()) as { embedding?: number[] };
      if (!data.embedding?.length) {
        throw new Error("Empty embedding returned by Ollama");
      }
      results.push(data.embedding);
    }

    return results;
  }

  public localFallbackEmbedding(text: string, dims = 128): number[] {
    const vec = new Array<number>(dims).fill(0);
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    for (const token of tokens) {
      let hash = 2166136261;
      for (let i = 0; i < token.length; i += 1) {
        hash ^= token.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const idx = Math.abs(hash) % dims;
      vec[idx] += 1;
    }

    const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
    return vec.map((v) => Number((v / norm).toFixed(6)));
  }
}
