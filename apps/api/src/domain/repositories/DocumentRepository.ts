import { Document, DocumentChunkProps } from "../entities/Document";

export interface ChunkSearchMatch {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
}

export interface DocumentRepository {
  saveWithChunks(
    document: Document,
    chunks: DocumentChunkProps[]
  ): Promise<void>;
  findByUserAndHash(
    userId: string,
    contentHash: string
  ): Promise<Document | null>;
  findAllByUserId(userId: string): Promise<Document[]>;
  findByIdsForUser(userId: string, documentIds: string[]): Promise<Document[]>;
  findExistingIdsForUser(
    userId: string,
    documentIds: string[]
  ): Promise<string[]>;
  setAgentDocuments(
    agentId: string,
    userId: string,
    documentIds: string[]
  ): Promise<void>;
  getAgentDocumentIds(agentId: string): Promise<string[]>;
  searchSimilarChunks(params: {
    userId: string;
    documentIds: string[];
    queryEmbedding: number[];
    queryText: string;
    limit?: number;
  }): Promise<ChunkSearchMatch[]>;
}
