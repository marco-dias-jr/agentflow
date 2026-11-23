export type ParserStrategy = "lightweight" | "strict";
export type ChunkStrategy = "fixed" | "paragraph" | "sentence";
export type EmbeddingProviderType = "auto" | "gemini" | "ollama" | "local";
export type ResolvedEmbeddingProviderType = Exclude<
  EmbeddingProviderType,
  "auto"
>;

export interface DocumentChunkProps {
  id: string;
  documentId: string;
  userId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  createdAt: Date;
}

export class DocumentChunk {
  public readonly id: string;
  public readonly documentId: string;
  public readonly userId: string;
  public readonly chunkIndex: number;
  public readonly content: string;
  public readonly embedding: number[];
  public readonly createdAt: Date;

  constructor(props: DocumentChunkProps) {
    this.id = props.id;
    this.documentId = props.documentId;
    this.userId = props.userId;
    this.chunkIndex = props.chunkIndex;
    this.content = props.content;
    this.embedding = props.embedding;
    this.createdAt = props.createdAt;
  }
}

export interface DocumentProps {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  mimeType: string;
  contentHash: string;
  chunkCount: number;
  parserStrategy?: ParserStrategy;
  chunkStrategy?: ChunkStrategy;
  chunkSize?: number;
  chunkOverlap?: number;
  embeddingProvider?: ResolvedEmbeddingProviderType;
  embeddingModel?: string;
  createdAt: Date;
}

export class Document {
  public readonly id: string;
  public readonly userId: string;
  public readonly title: string;
  public readonly fileName: string;
  public readonly mimeType: string;
  public readonly contentHash: string;
  public readonly chunkCount: number;
  public readonly parserStrategy: ParserStrategy;
  public readonly chunkStrategy: ChunkStrategy;
  public readonly chunkSize: number;
  public readonly chunkOverlap: number;
  public readonly embeddingProvider: ResolvedEmbeddingProviderType;
  public readonly embeddingModel: string;
  public readonly createdAt: Date;

  constructor(props: DocumentProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.title = props.title;
    this.fileName = props.fileName;
    this.mimeType = props.mimeType;
    this.contentHash = props.contentHash;
    this.chunkCount = props.chunkCount;
    this.parserStrategy = props.parserStrategy ?? "lightweight";
    this.chunkStrategy = props.chunkStrategy ?? "fixed";
    this.chunkSize = props.chunkSize ?? 800;
    this.chunkOverlap = props.chunkOverlap ?? 120;
    this.embeddingProvider = props.embeddingProvider ?? "local";
    this.embeddingModel = props.embeddingModel ?? "local-hash-128";
    this.createdAt = props.createdAt;
  }
}
