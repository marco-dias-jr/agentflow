import { describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import {
  GenerateInput,
  GenerateOutput,
  LLMProvider,
} from "../../apps/api/src/application/ports/LLMProvider";
import { ExecuteAgent } from "../../apps/api/src/application/use-cases/ExecuteAgent";
import { Agent } from "../../apps/api/src/domain/entities/Agent";
import { Document } from "../../apps/api/src/domain/entities/Document";
import { Execution } from "../../apps/api/src/domain/entities/Execution";
import { AgentRepository } from "../../apps/api/src/domain/repositories/AgentRepository";
import {
  ChunkSearchMatch,
  DocumentRepository,
} from "../../apps/api/src/domain/repositories/DocumentRepository";
import { ExecutionRepository } from "../../apps/api/src/domain/repositories/ExecutionRepository";
import {
  PostgresDocumentRepository,
  rankHybridChunks,
} from "../../apps/api/src/infrastructure/database/PostgresDocumentRepository";
import {
  formatCitationLabel,
  formatSnippetPreview,
  KnowledgeSearchTool,
} from "../../apps/api/src/infrastructure/tools/KnowledgeSearchTool";
import { ToolRegistryExecutor } from "../../apps/api/src/infrastructure/tools/ToolRegistryExecutor";

describe("Hybrid Search Ranking, Citations, and Trace Duration", () => {
  it("normalizes vector similarity and PostgreSQL FTS rank into [0, 1] hybrid scores", () => {
    const matches = rankHybridChunks({
      queryEmbedding: [1, 0, 0],
      limit: 3,
      candidates: [
        {
          chunkId: "chunk-vector-only",
          documentId: "doc-1",
          documentTitle: "Database Runbook",
          chunkIndex: 0,
          content: "Primary vector match without exact lexical overlap.",
          embedding: [0.9, 0.1, 0],
          ftsRank: 0,
        },
        {
          chunkId: "chunk-hybrid-best",
          documentId: "doc-1",
          documentTitle: "Database Runbook",
          chunkIndex: 1,
          content: "PostgreSQL failover and replica promotion steps.",
          embedding: [0.88, 0.12, 0],
          ftsRank: 0.8,
        },
        {
          chunkId: "chunk-lexical-only",
          documentId: "doc-2",
          documentTitle: "Incident Notes",
          chunkIndex: 0,
          content: "Failover notes with orthogonal embedding.",
          embedding: [0, 1, 0],
          ftsRank: 0.4,
        },
        {
          chunkId: "chunk-irrelevant",
          documentId: "doc-2",
          documentTitle: "Incident Notes",
          chunkIndex: 1,
          content: "Unrelated text.",
          embedding: [0, 0, 1],
          ftsRank: 0,
        },
      ],
    });

    expect(matches.length).toBe(3);
    expect(matches[0].chunkId).toBe("chunk-hybrid-best");
    expect(matches[0].lexicalScore).toBe(1);
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
    expect(matches[0].score).toBeLessThanOrEqual(1);
    expect(matches[1].chunkId).toBe("chunk-vector-only");
    expect(matches[2].chunkId).toBe("chunk-lexical-only");
    expect(matches[2].lexicalScore).toBe(0.5);
  });

  it("queries PostgreSQL full-text ranking scoped strictly by userId and documentIds", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [
        {
          chunk_id: "c-1",
          document_id: "doc-a",
          document_title: "API Gateway Guide",
          chunk_index: 2,
          content: "Configure rate limiting to 60 requests per minute.",
          embedding: [1, 0],
          fts_rank: 0.45,
        },
      ],
    });

    const mockPool = { query: queryMock } as unknown as Pool;
    const repo = new PostgresDocumentRepository(mockPool);

    const emptyResult = await repo.searchSimilarChunks({
      userId: "user-1",
      documentIds: [],
      queryEmbedding: [1, 0],
      queryText: "rate limit",
    });
    expect(emptyResult).toEqual([]);
    expect(queryMock).not.toHaveBeenCalled();

    const results = await repo.searchSimilarChunks({
      userId: "user-1",
      documentIds: ["doc-a", "doc-a"],
      queryEmbedding: [1, 0],
      queryText: "rate limit",
      limit: 5,
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ts_rank_cd");
    expect(sql).toContain("to_tsvector('english'");
    expect(sql).toContain("plainto_tsquery('english'");
    expect(sql).toContain("c.user_id = $1");
    expect(sql).toContain("d.user_id = $1");
    expect(sql).toContain("c.document_id = any($2::text[])");
    expect(params).toEqual(["user-1", ["doc-a"], "rate limit"]);

    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(1);
    expect(results[0].vectorScore).toBe(1);
    expect(results[0].lexicalScore).toBe(1);
  });

  it("formats verifiable citations and snippet previews in KnowledgeSearchTool", async () => {
    expect(formatCitationLabel("Security Policy", 0)).toBe(
      "[Security Policy, Chunk #1]"
    );
    expect(formatCitationLabel("Security Policy", 4)).toBe(
      "[Security Policy, Chunk #5]"
    );

    const longContent =
      "Access   tokens   expire after 15 minutes.\n\n" + "A".repeat(220);
    const snippet = formatSnippetPreview(longContent, 60);
    expect(snippet.startsWith("Access tokens expire after 15 minutes.")).toBe(
      true
    );
    expect(snippet.endsWith("...")).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(60);

    const doc = new Document({
      id: "doc-1",
      userId: "user-1",
      title: "Auth Runbook",
      fileName: "auth.md",
      mimeType: "text/markdown",
      contentHash: "hash-1",
      chunkCount: 3,
      embeddingProvider: "local",
      embeddingModel: "local-hash-128",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    const mockDocRepo: DocumentRepository = {
      saveWithChunks: vi.fn(),
      findByIdForUser: vi.fn(),
      findByUserAndHash: vi.fn(),
      findAllByUserId: vi.fn(),
      findByIdsForUser: vi.fn().mockResolvedValue([doc]),
      findExistingIdsForUser: vi.fn(),
      deleteByIdForUser: vi.fn(),
      setAgentDocuments: vi.fn(),
      getAgentDocumentIds: vi.fn().mockResolvedValue(["doc-1"]),
      searchSimilarChunks: vi.fn().mockResolvedValue([
        {
          chunkId: "chunk-2",
          documentId: "doc-1",
          documentTitle: "Auth Runbook",
          chunkIndex: 1,
          content:
            "Refresh tokens must be rotated on every POST /auth/refresh exchange.",
          score: 0.9125,
          vectorScore: 0.875,
          lexicalScore: 1,
        } satisfies ChunkSearchMatch,
      ]),
    };

    const tool = new KnowledgeSearchTool({
      documentRepository: mockDocRepo,
      embeddingProvider: {
        embedTexts: vi.fn().mockResolvedValue([[1, 0, 0]]),
      },
    });

    const output = await tool.execute(
      { query: "refresh token rotation", limit: 3 },
      { userId: "user-1", agentId: "agent-1", documentIds: ["doc-1"] }
    );

    expect(output.matches).toHaveLength(1);
    expect(output.matches[0].citation).toBe("[Auth Runbook, Chunk #2]");
    expect(output.matches[0].score).toBe(0.9125);
    expect(output.matches[0].snippet).toContain("Refresh tokens must be rotated");

    expect(output.citations).toEqual([
      {
        citation: "[Auth Runbook, Chunk #2]",
        documentId: "doc-1",
        title: "Auth Runbook",
        chunkIndex: 1,
        score: 0.9125,
        snippet:
          "Refresh tokens must be rotated on every POST /auth/refresh exchange.",
      },
    ]);
  });

  it("records durationMs and citations on Execution trace steps", async () => {
    const agent = Agent.create({
      id: "agent-1",
      userId: "user-1",
      name: "Ops Assistant",
      description: "Searches runbooks",
      systemPrompt: "Be helpful",
      provider: "mock",
      model: "mock-model",
      enabledTools: ["knowledge_search"],
    });

    const agentRepo: AgentRepository = {
      save: vi.fn(),
      findByIdForUser: vi.fn().mockResolvedValue(agent),
      findAllByUserId: vi.fn(),
      deleteByIdForUser: vi.fn(),
    };

    const savedExecutions: Execution[] = [];
    const executionRepo: ExecutionRepository = {
      save: vi.fn().mockImplementation(async (exec: Execution) => {
        savedExecutions.push(exec);
      }),
      update: vi.fn().mockResolvedValue(undefined),
      findByIdForUser: vi.fn(),
      findByAgentIdForUser: vi.fn(),
    };

    let callCount = 0;
    const llmProvider: LLMProvider = {
      generate: vi
        .fn()
        .mockImplementation(async (_input: GenerateInput): Promise<GenerateOutput> => {
          callCount += 1;
          if (callCount === 1) {
            return {
              provider: "mock",
              model: "mock-model",
              content: null,
              toolCalls: [
                {
                  id: "tc-1",
                  name: "knowledge_search",
                  arguments: { query: "webhook retry", limit: 2 },
                },
              ],
            };
          }
          return {
            provider: "mock",
            model: "mock-model",
            content: "Webhooks retry with exponential backoff [Webhook Retry Schedule, Chunk #1].",
            toolCalls: [],
          };
        }),
    };

    const toolExecutor = new ToolRegistryExecutor([new KnowledgeSearchTool()]);
    const useCase = new ExecuteAgent(
      agentRepo,
      executionRepo,
      llmProvider,
      toolExecutor
    );

    const execution = await useCase.execute({
      agentId: "agent-1",
      userId: "user-1",
      prompt: "How do webhook retries work?",
    });

    expect(execution.status).toBe("completed");
    const llmSteps = execution.trace.filter((s) => s.type === "llm_request");
    const toolResultSteps = execution.trace.filter(
      (s) => s.type === "tool_result"
    );
    const assistantStep = execution.trace.find(
      (s) => s.type === "assistant_response"
    );

    expect(llmSteps.length).toBe(2);
    for (const step of llmSteps) {
      expect(typeof step.durationMs).toBe("number");
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
    }

    expect(toolResultSteps).toHaveLength(1);
    expect(typeof toolResultSteps[0].durationMs).toBe("number");
    expect(toolResultSteps[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(toolResultSteps[0].payload?.citations)).toBe(true);
    const citations = toolResultSteps[0].payload?.citations as Array<{
      citation: string;
    }>;
    expect(citations[0].citation).toBe("[Webhook Retry Schedule, Chunk #1]");

    expect(typeof assistantStep?.durationMs).toBe("number");
    expect(assistantStep?.durationMs).toBeGreaterThanOrEqual(0);
  });
});
