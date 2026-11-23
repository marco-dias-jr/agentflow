import { Pool } from "pg";
import {
  ChunkStrategy,
  Document,
  DocumentChunkProps,
  ParserStrategy,
  ResolvedEmbeddingProviderType,
} from "../../domain/entities/Document";
import {
  ChunkSearchMatch,
  DocumentRepository,
} from "../../domain/repositories/DocumentRepository";

interface DocumentRow {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  mime_type: string;
  content_hash: string;
  chunk_count: number;
  parser_strategy: string | null;
  chunk_strategy: string | null;
  chunk_size: number | null;
  chunk_overlap: number | null;
  embedding_provider: string | null;
  embedding_model: string | null;
  created_at: Date | string;
}

interface ChunkSearchRow {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  content: string;
  embedding: number[] | string;
  fts_rank: number | string | null;
}

export interface HybridChunkCandidate {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  ftsRank: number;
}

const HYBRID_VECTOR_WEIGHT = 0.7;
const HYBRID_LEXICAL_WEIGHT = 0.3;
const MIN_HYBRID_SCORE = 0.05;

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Combines vector cosine similarity with normalized PostgreSQL full-text ranking.
 * Both signals are normalized to [0, 1] before weighted combination.
 */
export function rankHybridChunks(params: {
  candidates: HybridChunkCandidate[];
  queryEmbedding: number[];
  limit?: number;
}): ChunkSearchMatch[] {
  const limit = Math.max(1, Math.min(10, Math.floor(params.limit ?? 5)));
  if (params.candidates.length === 0) {
    return [];
  }

  const rawScores = params.candidates.map((candidate) => {
    const vectorSim = Math.max(
      0,
      Math.min(1, cosineSimilarity(params.queryEmbedding, candidate.embedding))
    );
    const ftsRank = Math.max(
      0,
      Number.isFinite(candidate.ftsRank) ? candidate.ftsRank : 0
    );
    return { candidate, vectorSim, ftsRank };
  });

  const maxFtsRank = rawScores.reduce(
    (max, item) => (item.ftsRank > max ? item.ftsRank : max),
    0
  );

  const scored: ChunkSearchMatch[] = [];

  for (const item of rawScores) {
    const normalizedLexical =
      maxFtsRank > 0 ? item.ftsRank / maxFtsRank : 0;
    const normalizedVector = item.vectorSim;

    const hybridScore =
      normalizedVector * HYBRID_VECTOR_WEIGHT +
      normalizedLexical * HYBRID_LEXICAL_WEIGHT;

    if (hybridScore >= MIN_HYBRID_SCORE || normalizedLexical > 0) {
      scored.push({
        chunkId: item.candidate.chunkId,
        documentId: item.candidate.documentId,
        documentTitle: item.candidate.documentTitle,
        chunkIndex: item.candidate.chunkIndex,
        content: item.candidate.content,
        score: Number(hybridScore.toFixed(4)),
        vectorScore: Number(normalizedVector.toFixed(4)),
        lexicalScore: Number(normalizedLexical.toFixed(4)),
      });
    }
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score || a.chunkIndex - b.chunkIndex
    )
    .slice(0, limit);
}

export class PostgresDocumentRepository implements DocumentRepository {
  constructor(private readonly pool: Pool) {}

  public async saveWithChunks(
    document: Document,
    chunks: DocumentChunkProps[]
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `
          insert into documents (
            id, user_id, title, file_name, mime_type, content_hash, chunk_count,
            parser_strategy, chunk_strategy, chunk_size, chunk_overlap,
            embedding_provider, embedding_model, created_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `,
        [
          document.id,
          document.userId,
          document.title,
          document.fileName,
          document.mimeType,
          document.contentHash,
          document.chunkCount,
          document.parserStrategy,
          document.chunkStrategy,
          document.chunkSize,
          document.chunkOverlap,
          document.embeddingProvider,
          document.embeddingModel,
          document.createdAt.toISOString(),
        ]
      );

      for (const chunk of chunks) {
        await client.query(
          `
            insert into document_chunks (
              id, document_id, user_id, chunk_index, content, embedding, created_at
            )
            values ($1, $2, $3, $4, $5, $6::jsonb, $7)
          `,
          [
            chunk.id,
            chunk.documentId,
            chunk.userId,
            chunk.chunkIndex,
            chunk.content,
            JSON.stringify(chunk.embedding),
            chunk.createdAt.toISOString(),
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async findByIdForUser(
    id: string,
    userId: string
  ): Promise<Document | null> {
    const result = await this.pool.query<DocumentRow>(
      `
        select id, user_id, title, file_name, mime_type, content_hash, chunk_count,
               parser_strategy, chunk_strategy, chunk_size, chunk_overlap,
               embedding_provider, embedding_model, created_at
        from documents
        where id = $1 and user_id = $2
        limit 1
      `,
      [id, userId]
    );

    const row = result.rows[0];
    return row ? this.mapRowToEntity(row) : null;
  }

  public async findByUserAndHash(
    userId: string,
    contentHash: string
  ): Promise<Document | null> {
    const result = await this.pool.query<DocumentRow>(
      `
        select id, user_id, title, file_name, mime_type, content_hash, chunk_count,
               parser_strategy, chunk_strategy, chunk_size, chunk_overlap,
               embedding_provider, embedding_model, created_at
        from documents
        where user_id = $1 and content_hash = $2
        limit 1
      `,
      [userId, contentHash]
    );

    const row = result.rows[0];
    return row ? this.mapRowToEntity(row) : null;
  }

  public async findAllByUserId(userId: string): Promise<Document[]> {
    const result = await this.pool.query<DocumentRow>(
      `
        select id, user_id, title, file_name, mime_type, content_hash, chunk_count,
               parser_strategy, chunk_strategy, chunk_size, chunk_overlap,
               embedding_provider, embedding_model, created_at
        from documents
        where user_id = $1
        order by created_at desc
      `,
      [userId]
    );

    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  public async findByIdsForUser(
    userId: string,
    documentIds: string[]
  ): Promise<Document[]> {
    const uniqueIds = Array.from(
      new Set(documentIds.map((id) => id.trim()).filter(Boolean))
    );
    if (uniqueIds.length === 0) return [];

    const result = await this.pool.query<DocumentRow>(
      `
        select id, user_id, title, file_name, mime_type, content_hash, chunk_count,
               parser_strategy, chunk_strategy, chunk_size, chunk_overlap,
               embedding_provider, embedding_model, created_at
        from documents
        where user_id = $1 and id = any($2::text[])
      `,
      [userId, uniqueIds]
    );

    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  public async findExistingIdsForUser(
    userId: string,
    documentIds: string[]
  ): Promise<string[]> {
    const uniqueIds = Array.from(
      new Set(documentIds.map((id) => id.trim()).filter(Boolean))
    );
    if (uniqueIds.length === 0) return [];

    const result = await this.pool.query<{ id: string }>(
      `
        select id
        from documents
        where user_id = $1 and id = any($2::text[])
      `,
      [userId, uniqueIds]
    );

    return result.rows.map((row) => row.id);
  }

  public async deleteByIdForUser(id: string, userId: string): Promise<void> {
    await this.pool.query(
      `
        delete from documents
        where id = $1 and user_id = $2
      `,
      [id, userId]
    );
  }

  public async setAgentDocuments(
    agentId: string,
    userId: string,
    documentIds: string[]
  ): Promise<void> {
    const uniqueIds = Array.from(
      new Set(documentIds.map((id) => id.trim()).filter(Boolean))
    );

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `
          delete from agent_documents
          where agent_id = $1
            and exists (
              select 1 from agents where id = $1 and user_id = $2
            )
        `,
        [agentId, userId]
      );

      if (uniqueIds.length > 0) {
        await client.query(
          `
            insert into agent_documents (agent_id, document_id)
            select a.id, d.id
            from agents a
            inner join documents d
              on d.user_id = $2 and d.id = any($3::text[])
            where a.id = $1 and a.user_id = $2
            on conflict (agent_id, document_id) do nothing
          `,
          [agentId, userId, uniqueIds]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async getAgentDocumentIds(agentId: string): Promise<string[]> {
    const result = await this.pool.query<{ document_id: string }>(
      `
        select document_id
        from agent_documents
        where agent_id = $1
        order by created_at asc
      `,
      [agentId]
    );

    return result.rows.map((row) => row.document_id);
  }

  public async searchSimilarChunks(params: {
    userId: string;
    documentIds: string[];
    queryEmbedding: number[];
    queryText: string;
    limit?: number;
  }): Promise<ChunkSearchMatch[]> {
    const uniqueIds = Array.from(
      new Set(params.documentIds.map((id) => id.trim()).filter(Boolean))
    );
    if (uniqueIds.length === 0) {
      return [];
    }

    const limit = Math.max(1, Math.min(10, Math.floor(params.limit ?? 5)));
    const normalizedQueryText = params.queryText.trim();

    const result = await this.pool.query<ChunkSearchRow>(
      `
        select
          c.id as chunk_id,
          c.document_id,
          d.title as document_title,
          c.chunk_index,
          c.content,
          c.embedding,
          case
            when $3 = '' then 0
            else ts_rank_cd(
              to_tsvector('english', coalesce(d.title, '') || ' ' || c.content),
              plainto_tsquery('english', $3)
            )
          end as fts_rank
        from document_chunks c
        inner join documents d on d.id = c.document_id
        where c.user_id = $1
          and d.user_id = $1
          and c.document_id = any($2::text[])
      `,
      [params.userId, uniqueIds, normalizedQueryText]
    );

    const candidates: HybridChunkCandidate[] = result.rows.map((row) => {
      const chunkEmbedding = Array.isArray(row.embedding)
        ? row.embedding
        : typeof row.embedding === "string"
          ? (JSON.parse(row.embedding) as number[])
          : [];

      const ftsRank =
        typeof row.fts_rank === "number"
          ? row.fts_rank
          : typeof row.fts_rank === "string"
            ? Number.parseFloat(row.fts_rank) || 0
            : 0;

      return {
        chunkId: row.chunk_id,
        documentId: row.document_id,
        documentTitle: row.document_title,
        chunkIndex: row.chunk_index,
        content: row.content,
        embedding: chunkEmbedding,
        ftsRank,
      };
    });

    return rankHybridChunks({
      candidates,
      queryEmbedding: params.queryEmbedding,
      limit,
    });
  }

  private mapRowToEntity(row: DocumentRow): Document {
    return new Document({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      fileName: row.file_name,
      mimeType: row.mime_type,
      contentHash: row.content_hash,
      chunkCount: Number(row.chunk_count ?? 0),
      parserStrategy:
        (row.parser_strategy as ParserStrategy | null) ?? "lightweight",
      chunkStrategy: (row.chunk_strategy as ChunkStrategy | null) ?? "fixed",
      chunkSize: row.chunk_size ?? 800,
      chunkOverlap: row.chunk_overlap ?? 120,
      embeddingProvider:
        (row.embedding_provider as ResolvedEmbeddingProviderType | null) ??
        "local",
      embeddingModel: row.embedding_model ?? "local-hash-128",
      createdAt: new Date(row.created_at),
    });
  }
}
