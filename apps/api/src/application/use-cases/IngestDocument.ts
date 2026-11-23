import crypto from "node:crypto";
import {
  Document,
  DocumentChunkProps,
  ParserStrategy,
} from "../../domain/entities/Document";
import { DocumentRepository } from "../../domain/repositories/DocumentRepository";
import { ChunkOptions, TextChunker } from "../../infrastructure/rag/TextChunker";
import {
  DocumentParserPort,
  ParseDocumentOptions,
} from "../ports/DocumentParserPort";
import { EmbeddingOptions, EmbeddingProvider } from "../ports/EmbeddingProvider";

export interface IngestDocumentCommand {
  userId: string;
  title: string;
  fileName: string;
  mimeType: string;
  contentBuffer: Buffer;
  parser?: ParseDocumentOptions;
  chunking?: ChunkOptions;
  embedding?: EmbeddingOptions;
}

export interface IngestDocumentResult {
  document: Document;
  deduplicated: boolean;
}

export class IngestDocument {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly parser: DocumentParserPort,
    private readonly chunker: TextChunker,
    private readonly embeddingService: EmbeddingProvider
  ) {}

  public async execute(
    command: IngestDocumentCommand
  ): Promise<IngestDocumentResult> {
    const cleanFileName =
      command.fileName
        .replace(/[/\\]/g, "_")
        .replace(/[^\w.\- ()]/g, "_")
        .trim() || "document.txt";

    const parserStrategy: ParserStrategy =
      command.parser?.strategy ?? "lightweight";
    const extractedText = this.parser.parseToText(
      command.contentBuffer,
      command.mimeType,
      cleanFileName,
      command.parser
    );

    if (!extractedText) {
      throw new Error("Document contains no extractable text content.");
    }

    // Strict per-account content deduplication to avoid duplicate storage and embedding costs
    const contentHash = crypto
      .createHash("sha256")
      .update(extractedText)
      .digest("hex");

    const existing = await this.documentRepository.findByUserAndHash(
      command.userId,
      contentHash
    );
    if (existing) {
      return {
        document: existing,
        deduplicated: true,
      };
    }

    const chunkConfig = this.chunker.resolveOptions(command.chunking);
    const rawChunks = this.chunker.chunk(extractedText, chunkConfig);
    const embeddingResult = await this.embeddingService.embedTextsWithMetadata(
      rawChunks,
      command.embedding
    );

    const now = new Date();
    const documentId = crypto.randomUUID();

    const document = new Document({
      id: documentId,
      userId: command.userId,
      title: command.title.trim() || cleanFileName,
      fileName: cleanFileName,
      mimeType: command.mimeType || "text/plain",
      contentHash,
      chunkCount: rawChunks.length,
      parserStrategy,
      chunkStrategy: chunkConfig.strategy,
      chunkSize: chunkConfig.chunkSize,
      chunkOverlap: chunkConfig.overlap,
      embeddingProvider: embeddingResult.provider,
      embeddingModel: embeddingResult.model,
      createdAt: now,
    });

    const chunkRecords: DocumentChunkProps[] = rawChunks.map(
      (content, idx) => ({
        id: crypto.randomUUID(),
        documentId,
        userId: command.userId,
        chunkIndex: idx,
        content,
        embedding: embeddingResult.embeddings[idx] ?? [],
        createdAt: now,
      })
    );

    await this.documentRepository.saveWithChunks(document, chunkRecords);

    return {
      document,
      deduplicated: false,
    };
  }
}
