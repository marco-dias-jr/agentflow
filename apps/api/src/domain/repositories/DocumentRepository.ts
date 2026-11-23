import { Document, DocumentChunkProps } from "../entities/Document";

export interface ChunkSearchMatch {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
  vectorScore?: number;
  lexicalScore?: number;
}

export interface DocumentRepository {
  saveWithChunks(
    document: Document,
    chunks: DocumentChunkProps[]
  ): Promise<void>;
  findByIdForUser(id: string, userId: string): Promise<Document | null>;
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
  deleteByIdForUser(id: string, userId: string): Promise<void>;
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
