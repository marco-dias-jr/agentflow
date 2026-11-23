import {
  EmbeddingProviderType,
  ResolvedEmbeddingProviderType,
} from "../../domain/entities/Document";

export interface EmbeddingOptions {
  provider?: EmbeddingProviderType;
  model?: string;
}

export interface ResolvedEmbeddingConfig {
  provider: ResolvedEmbeddingProviderType;
  model: string;
}

export interface EmbeddingResult {
  embeddings: number[][];
  provider: ResolvedEmbeddingProviderType;
  model: string;
}

export interface EmbeddingProvider {
  resolveConfig(options?: EmbeddingOptions): ResolvedEmbeddingConfig;
  embedTexts(texts: string[], options?: EmbeddingOptions): Promise<number[][]>;
  embedTextsWithMetadata(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult>;
}
