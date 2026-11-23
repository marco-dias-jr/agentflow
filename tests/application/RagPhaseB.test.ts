import { describe, expect, it } from "vitest";
import {
  GenerateInput,
  GenerateOutput,
  LLMProvider,
} from "../../apps/api/src/application/ports/LLMProvider";
import { CreateAgent } from "../../apps/api/src/application/use-cases/CreateAgent";
import { ExecuteAgent } from "../../apps/api/src/application/use-cases/ExecuteAgent";
import { IngestDocument } from "../../apps/api/src/application/use-cases/IngestDocument";
import { UpdateAgent } from "../../apps/api/src/application/use-cases/UpdateAgent";
import { Agent } from "../../apps/api/src/domain/entities/Agent";
import {
  Document,
  DocumentChunkProps,
} from "../../apps/api/src/domain/entities/Document";
import { Execution } from "../../apps/api/src/domain/entities/Execution";
import { AgentRepository } from "../../apps/api/src/domain/repositories/AgentRepository";
import {
  ChunkSearchMatch,
  DocumentRepository,
} from "../../apps/api/src/domain/repositories/DocumentRepository";
import { ExecutionRepository } from "../../apps/api/src/domain/repositories/ExecutionRepository";
import { DocumentParser } from "../../apps/api/src/infrastructure/rag/DocumentParser";
import { EmbeddingService } from "../../apps/api/src/infrastructure/rag/EmbeddingService";
import { TextChunker } from "../../apps/api/src/infrastructure/rag/TextChunker";
import { KnowledgeSearchTool } from "../../apps/api/src/infrastructure/tools/KnowledgeSearchTool";
import { ToolRegistryExecutor } from "../../apps/api/src/infrastructure/tools/ToolRegistryExecutor";

function cosineSim(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

class InMemoryDocumentRepository implements DocumentRepository {
  public documents = new Map<string, Document>();
  public chunks: DocumentChunkProps[] = [];
  public agentLinks = new Map<string, string[]>();

  public async saveWithChunks(
    document: Document,
    chunks: DocumentChunkProps[]
  ): Promise<void> {
    this.documents.set(document.id, document);
    this.chunks.push(...chunks);
  }

  public async findByUserAndHash(
    userId: string,
    contentHash: string
  ): Promise<Document | null> {
    for (const doc of this.documents.values()) {
      if (doc.userId === userId && doc.contentHash === contentHash) {
        return doc;
      }
    }
    return null;
  }

  public async findAllByUserId(userId: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.userId === userId
    );
  }

  public async findByIdsForUser(
    userId: string,
    documentIds: string[]
  ): Promise<Document[]> {
    const idSet = new Set(documentIds);
    return Array.from(this.documents.values()).filter(
      (doc) => doc.userId === userId && idSet.has(doc.id)
    );
  }

  public async findExistingIdsForUser(
    userId: string,
    documentIds: string[]
  ): Promise<string[]> {
    const docs = await this.findByIdsForUser(userId, documentIds);
    return docs.map((d) => d.id);
  }

  public async setAgentDocuments(
    agentId: string,
    userId: string,
    documentIds: string[]
  ): Promise<void> {
    const validIds = await this.findExistingIdsForUser(userId, documentIds);
    this.agentLinks.set(agentId, validIds);
  }

  public async getAgentDocumentIds(agentId: string): Promise<string[]> {
    return this.agentLinks.get(agentId) ?? [];
  }

  public async searchSimilarChunks(params: {
    userId: string;
    documentIds: string[];
    queryEmbedding: number[];
    queryText: string;
    limit?: number;
  }): Promise<ChunkSearchMatch[]> {
    const allowedDocIds = new Set(params.documentIds);
    const terms = params.queryText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    const matches: ChunkSearchMatch[] = [];
    for (const chunk of this.chunks) {
      if (chunk.userId !== params.userId) continue;
      if (!allowedDocIds.has(chunk.documentId)) continue;
      const doc = this.documents.get(chunk.documentId);
      if (!doc || doc.userId !== params.userId) continue;

      const vectorScore = Math.max(
        0,
        cosineSim(params.queryEmbedding, chunk.embedding)
      );
      const haystack = `${doc.title} ${chunk.content}`.toLowerCase();
      const lexical =
        terms.length === 0
          ? 0
          : terms.filter((t) => haystack.includes(t)).length / terms.length;
      const score =
        vectorScore > 0 ? vectorScore * 0.75 + lexical * 0.25 : lexical * 0.65;

      if (score >= 0.08 || lexical > 0) {
        matches.push({
          chunkId: chunk.id,
          documentId: doc.id,
          documentTitle: doc.title,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: Number(score.toFixed(4)),
        });
      }
    }

    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit ?? 5);
  }
}

class InMemoryAgentRepository implements AgentRepository {
  public items = new Map<string, Agent>();

  public async save(agent: Agent): Promise<void> {
    this.items.set(agent.id, agent);
  }

  public async findByIdForUser(
    id: string,
    userId: string
  ): Promise<Agent | null> {
    const agent = this.items.get(id);
    return agent && agent.userId === userId ? agent : null;
  }

  public async findAllByUserId(userId: string): Promise<Agent[]> {
    return Array.from(this.items.values()).filter((a) => a.userId === userId);
  }

  public async deleteByIdForUser(id: string, userId: string): Promise<void> {
    const agent = this.items.get(id);
    if (agent && agent.userId === userId) {
      this.items.delete(id);
    }
  }
}

class InMemoryExecutionRepository implements ExecutionRepository {
  public items = new Map<string, Execution>();

  public async save(execution: Execution): Promise<void> {
    this.items.set(execution.id, execution);
  }

  public async update(execution: Execution): Promise<void> {
    this.items.set(execution.id, execution);
  }

  public async findByIdForUser(
    id: string,
    userId: string
  ): Promise<Execution | null> {
    const exec = this.items.get(id);
    return exec && exec.userId === userId ? exec : null;
  }

  public async findByAgentIdForUser(
    agentId: string,
    userId: string
  ): Promise<Execution[]> {
    return Array.from(this.items.values()).filter(
      (e) => e.agentId === agentId && e.userId === userId
    );
  }
}

class ScriptedRagLLMProvider implements LLMProvider {
  private calls = 0;

  public async generate(_input: GenerateInput): Promise<GenerateOutput> {
    this.calls += 1;
    if (this.calls === 1) {
      return {
        provider: "mock",
        model: "mock-rag",
        content: null,
        toolCalls: [
          {
            id: "rag-call-1",
            name: "knowledge_search",
            arguments: { query: "database failover recovery steps", limit: 3 },
          },
        ],
      };
    }

    return {
      provider: "mock",
      model: "mock-rag",
      content: "According to the runbook, promote the read replica during failover.",
      toolCalls: [],
    };
  }
}

describe("Phase B RAG Pipeline, Document Reuse, and Isolation", () => {
  it("ingests documents with custom RAG config and deduplicates per account (Option A)", async () => {
    const docRepo = new InMemoryDocumentRepository();
    const parser = new DocumentParser();
    const chunker = new TextChunker();
    const embeddingService = new EmbeddingService();
    const ingest = new IngestDocument(docRepo, parser, chunker, embeddingService);

    const content = Buffer.from(
      "Paragraph one covers PostgreSQL failover.\n\nParagraph two covers read replica promotion.",
      "utf-8"
    );

    const first = await ingest.execute({
      userId: "user-a",
      title: "Failover Runbook",
      fileName: "failover.md",
      mimeType: "text/markdown",
      contentBuffer: content,
      chunking: { strategy: "paragraph", chunkSize: 120, overlap: 20 },
      embedding: { provider: "local" },
    });

    expect(first.deduplicated).toBe(false);
    expect(first.document.chunkStrategy).toBe("paragraph");
    expect(first.document.embeddingProvider).toBe("local");
    expect(first.document.chunkCount).toBeGreaterThan(0);

    // Same user, same content -> deduplicated
    const duplicate = await ingest.execute({
      userId: "user-a",
      title: "Duplicate Copy",
      fileName: "failover-copy.md",
      mimeType: "text/markdown",
      contentBuffer: content,
      embedding: { provider: "local" },
    });

    expect(duplicate.deduplicated).toBe(true);
    expect(duplicate.document.id).toBe(first.document.id);

    // Different user, same content -> indexed separately for isolation
    const otherUser = await ingest.execute({
      userId: "user-b",
      title: "User B Copy",
      fileName: "failover.md",
      mimeType: "text/markdown",
      contentBuffer: content,
      embedding: { provider: "local" },
    });

    expect(otherUser.deduplicated).toBe(false);
    expect(otherUser.document.id).not.toBe(first.document.id);
  });

  it("links and updates account documents on CreateAgent and UpdateAgent while rejecting unauthorized IDs", async () => {
    const agentRepo = new InMemoryAgentRepository();
    const docRepo = new InMemoryDocumentRepository();
    const ingest = new IngestDocument(
      docRepo,
      new DocumentParser(),
      new TextChunker(),
      new EmbeddingService()
    );

    const userADoc1 = (
      await ingest.execute({
        userId: "user-a",
        title: "Doc 1",
        fileName: "doc1.txt",
        mimeType: "text/plain",
        contentBuffer: Buffer.from("Billing policy content", "utf-8"),
        embedding: { provider: "local" },
      })
    ).document;

    const userADoc2 = (
      await ingest.execute({
        userId: "user-a",
        title: "Doc 2",
        fileName: "doc2.txt",
        mimeType: "text/plain",
        contentBuffer: Buffer.from("Security policy content", "utf-8"),
        embedding: { provider: "local" },
      })
    ).document;

    const userBDoc = (
      await ingest.execute({
        userId: "user-b",
        title: "Secret User B Doc",
        fileName: "secret.txt",
        mimeType: "text/plain",
        contentBuffer: Buffer.from("Top secret user B information", "utf-8"),
        embedding: { provider: "local" },
      })
    ).document;

    const createAgent = new CreateAgent(agentRepo, docRepo);
    const updateAgent = new UpdateAgent(agentRepo, docRepo);

    // Rejects creating agent with another user's document
    await expect(
      createAgent.execute({
        userId: "user-a",
        name: "Unauthorized Agent",
        systemPrompt: "Help users",
        provider: "gemini",
        model: "gemini-2.5-flash",
        enabledTools: ["knowledge_search"],
        documentIds: [userBDoc.id],
      })
    ).rejects.toThrow("Invalid or unauthorized documentIds");

    // Creates agent with valid account document
    const created = await createAgent.execute({
      userId: "user-a",
      name: "Ops Agent",
      systemPrompt: "Help ops",
      provider: "gemini",
      model: "gemini-2.5-flash",
      enabledTools: ["knowledge_search"],
      documentIds: [userADoc1.id, userADoc1.id],
    });

    expect(created.documentIds).toEqual([userADoc1.id]);
    expect(await docRepo.getAgentDocumentIds(created.id)).toEqual([userADoc1.id]);

    // Updates agent to swap linked documents without reprocessing
    const updated = await updateAgent.execute({
      id: created.id,
      userId: "user-a",
      documentIds: [userADoc2.id],
    });

    expect(updated.documentIds).toEqual([userADoc2.id]);
    expect(await docRepo.getAgentDocumentIds(created.id)).toEqual([userADoc2.id]);

    // Rejects updating agent with another user's document
    await expect(
      updateAgent.execute({
        id: created.id,
        userId: "user-a",
        documentIds: [userBDoc.id],
      })
    ).rejects.toThrow("Invalid or unauthorized documentIds");
  });

  it("isolates KnowledgeSearchTool to active agent documents and records full execution trace", async () => {
    const agentRepo = new InMemoryAgentRepository();
    const executionRepo = new InMemoryExecutionRepository();
    const docRepo = new InMemoryDocumentRepository();
    const embeddingService = new EmbeddingService();
    const ingest = new IngestDocument(
      docRepo,
      new DocumentParser(),
      new TextChunker(),
      embeddingService
    );

    const linkedDoc = (
      await ingest.execute({
        userId: "user-a",
        title: "Database Failover Guide",
        fileName: "db-failover.md",
        mimeType: "text/markdown",
        contentBuffer: Buffer.from(
          "Database failover recovery steps: promote the read replica and update the connection string.",
          "utf-8"
        ),
        embedding: { provider: "local" },
      })
    ).document;

    // Document belonging to the same user but NOT linked to this agent
    await ingest.execute({
      userId: "user-a",
      title: "Unlinked HR Policy",
      fileName: "hr.md",
      mimeType: "text/markdown",
      contentBuffer: Buffer.from(
        "Database failover recovery steps are not in HR, this is unlinked HR data.",
        "utf-8"
      ),
      embedding: { provider: "local" },
    });

    // Document belonging to another user
    await ingest.execute({
      userId: "user-b",
      title: "User B Failover Secret",
      fileName: "user-b-secret.md",
      mimeType: "text/markdown",
      contentBuffer: Buffer.from(
        "Database failover recovery steps secret for user B only.",
        "utf-8"
      ),
      embedding: { provider: "local" },
    });

    const createAgent = new CreateAgent(agentRepo, docRepo);
    const agent = await createAgent.execute({
      userId: "user-a",
      name: "DBA Assistant",
      systemPrompt: "Use knowledge_search to answer database questions.",
      provider: "mock",
      model: "mock-rag",
      enabledTools: ["knowledge_search"],
      documentIds: [linkedDoc.id],
    });

    const knowledgeTool = new KnowledgeSearchTool({
      documentRepository: docRepo,
      embeddingProvider: embeddingService,
    });
    const toolExecutor = new ToolRegistryExecutor([knowledgeTool]);
    const executeAgent = new ExecuteAgent(
      agentRepo,
      executionRepo,
      new ScriptedRagLLMProvider(),
      toolExecutor
    );

    const execution = await executeAgent.execute({
      agentId: agent.id,
      userId: "user-a",
      prompt: "What are the database failover recovery steps?",
    });

    expect(execution.status).toBe("completed");
    const toolResultStep = execution.trace.find((s) => s.type === "tool_result");
    expect(toolResultStep).toBeDefined();

    const output = toolResultStep?.payload?.output as {
      matches: Array<{ documentId: string; title: string; chunkIndex: number }>;
    };
    expect(output.matches.length).toBe(1);
    expect(output.matches[0].documentId).toBe(linkedDoc.id);
    expect(output.matches[0].title).toBe("Database Failover Guide");
    expect(output.matches[0].chunkIndex).toBe(0);

    // Agent with no linked documents returns clear structured message without error
    const emptyResult = await knowledgeTool.execute(
      { query: "database failover" },
      { userId: "user-a", agentId: "agent-without-docs", documentIds: [] }
    );
    expect(emptyResult.matches).toEqual([]);
    expect(emptyResult.message).toContain("No documents are linked");
  });
});
