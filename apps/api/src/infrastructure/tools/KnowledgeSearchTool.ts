import { EmbeddingProvider } from "../../application/ports/EmbeddingProvider";
import { ToolDefinition } from "../../application/ports/LLMProvider";
import { ToolExecutionContext } from "../../application/ports/ToolExecutor";
import { DocumentRepository } from "../../domain/repositories/DocumentRepository";
import { AgentTool } from "./AgentTool";

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

export interface KnowledgeCitation {
  citation: string;
  documentId?: string;
  title: string;
  chunkIndex: number;
  score: number;
  snippet: string;
}

export interface KnowledgeSearchMatch {
  id: string;
  documentId?: string;
  title: string;
  chunkIndex?: number;
  content: string;
  score: number;
  vectorScore?: number;
  lexicalScore?: number;
  citation: string;
  snippet: string;
}

export interface KnowledgeSearchOutput {
  query: string;
  matches: KnowledgeSearchMatch[];
  citations?: KnowledgeCitation[];
  message?: string;
}

export function formatCitationLabel(title: string, chunkIndex = 0): string {
  const safeTitle = title.trim() || "Untitled Document";
  const chunkNumber = Math.max(1, Math.floor(chunkIndex) + 1);
  return `[${safeTitle}, Chunk #${chunkNumber}]`;
}

export function formatSnippetPreview(
  content: string,
  maxLength = 200
): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  return `${collapsed.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

export interface KnowledgeSearchDependencies {
  documentRepository: DocumentRepository;
  embeddingProvider: EmbeddingProvider;
}

const DEFAULT_KNOWLEDGE_BASE: KnowledgeDocument[] = [
  {
    id: "kb-001",
    title: "API Rate Limit Policy",
    content:
      "Standard workspaces allow up to 60 requests per minute. Burst traffic returns HTTP 429 with a Retry-After header.",
    tags: ["api", "rate-limit", "429", "quota"],
  },
  {
    id: "kb-002",
    title: "Database Connection Timeout Troubleshooting",
    content:
      "Verify connection pooling limits, check SSL mode requirements, and confirm firewall allowlists when latency exceeds 5 seconds.",
    tags: ["database", "timeout", "postgres", "connection"],
  },
  {
    id: "kb-003",
    title: "Webhook Retry Schedule",
    content:
      "Failed webhook deliveries retry with exponential backoff at 1 minute, 5 minutes, 30 minutes, and 2 hours before marking as dead-letter.",
    tags: ["webhook", "retry", "backoff", "delivery"],
  },
  {
    id: "kb-004",
    title: "Authentication Token Expiration",
    content:
      "Access tokens expire after 15 minutes. Clients must exchange refresh tokens via POST /auth/refresh before expiration.",
    tags: ["auth", "token", "jwt", "refresh"],
  },
];

export class KnowledgeSearchTool implements AgentTool {
  public readonly definition: ToolDefinition = {
    name: "knowledge_search",
    description:
      "Searches the documents linked to this agent for relevant passages, policies, and operational knowledge.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keywords or operational question",
        },
        limit: {
          type: "number",
          description: "Maximum number of matching passages to return (1 to 5)",
        },
      },
      required: ["query"],
    },
  };

  private readonly documentRepository?: DocumentRepository;
  private readonly embeddingProvider?: EmbeddingProvider;
  private readonly fallbackDocuments: KnowledgeDocument[];

  constructor(
    depsOrDocuments?: KnowledgeSearchDependencies | KnowledgeDocument[]
  ) {
    if (Array.isArray(depsOrDocuments)) {
      this.fallbackDocuments = depsOrDocuments;
    } else if (depsOrDocuments) {
      this.documentRepository = depsOrDocuments.documentRepository;
      this.embeddingProvider = depsOrDocuments.embeddingProvider;
      this.fallbackDocuments = DEFAULT_KNOWLEDGE_BASE;
    } else {
      this.fallbackDocuments = DEFAULT_KNOWLEDGE_BASE;
    }
  }

  public async execute(
    args: Record<string, unknown>,
    context?: ToolExecutionContext
  ): Promise<KnowledgeSearchOutput> {
    const rawQuery = args.query;
    if (typeof rawQuery !== "string" || !rawQuery.trim()) {
      throw new Error("Invalid argument: 'query' must be a non-empty string.");
    }

    const query = rawQuery.trim();
    const rawLimit = typeof args.limit === "number" ? args.limit : 3;
    const limit = Math.max(1, Math.min(5, Math.floor(rawLimit)));

    if (this.documentRepository && this.embeddingProvider) {
      return this.executeRagSearch(query, limit, context);
    }

    return this.executeFallbackSearch(query, limit);
  }

  private async executeRagSearch(
    query: string,
    limit: number,
    context?: ToolExecutionContext
  ): Promise<KnowledgeSearchOutput> {
    if (!context?.userId || !context?.agentId) {
      return {
        query,
        matches: [],
        message:
          "Knowledge search requires an authenticated user and agent context.",
      };
    }

    const linkedDocumentIds =
      context.documentIds !== undefined
        ? context.documentIds
        : await this.documentRepository!.getAgentDocumentIds(context.agentId);

    const uniqueDocIds = Array.from(
      new Set(linkedDocumentIds.map((id) => id.trim()).filter(Boolean))
    );

    if (uniqueDocIds.length === 0) {
      return {
        query,
        matches: [],
        message:
          "No documents are linked to this agent. Attach documents to this agent to enable knowledge search.",
      };
    }

    const linkedDocs = await this.documentRepository!.findByIdsForUser(
      context.userId,
      uniqueDocIds
    );

    if (linkedDocs.length === 0) {
      return {
        query,
        matches: [],
        message:
          "No accessible documents were found for this agent in your account.",
      };
    }

    // Group documents by their indexing embedding profile so query vectors match each document's vector space
    const groups = new Map<
      string,
      {
        provider: (typeof linkedDocs)[number]["embeddingProvider"];
        model: string;
        docIds: string[];
      }
    >();

    for (const doc of linkedDocs) {
      const key = `${doc.embeddingProvider}::${doc.embeddingModel}`;
      const existingGroup = groups.get(key);
      if (existingGroup) {
        existingGroup.docIds.push(doc.id);
      } else {
        groups.set(key, {
          provider: doc.embeddingProvider,
          model: doc.embeddingModel,
          docIds: [doc.id],
        });
      }
    }

    const allMatches: KnowledgeSearchMatch[] = [];

    for (const group of groups.values()) {
      const embeddings = await this.embeddingProvider!.embedTexts([query], {
        provider: group.provider,
        model: group.model,
      });
      const queryEmbedding = embeddings[0] ?? [];

      const groupMatches = await this.documentRepository!.searchSimilarChunks({
        userId: context.userId,
        documentIds: group.docIds,
        queryEmbedding,
        queryText: query,
        limit,
      });

      for (const match of groupMatches) {
        allMatches.push({
          id: match.chunkId,
          documentId: match.documentId,
          title: match.documentTitle,
          chunkIndex: match.chunkIndex,
          content: match.content,
          score: match.score,
          ...(match.vectorScore !== undefined
            ? { vectorScore: match.vectorScore }
            : {}),
          ...(match.lexicalScore !== undefined
            ? { lexicalScore: match.lexicalScore }
            : {}),
          citation: formatCitationLabel(match.documentTitle, match.chunkIndex),
          snippet: formatSnippetPreview(match.content),
        });
      }
    }

    const ranked = allMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (ranked.length === 0) {
      return {
        query,
        matches: [],
        citations: [],
        message:
          "No relevant passages were found in the documents linked to this agent.",
      };
    }

    return {
      query,
      matches: ranked,
      citations: ranked.map((match) => ({
        citation: match.citation,
        documentId: match.documentId,
        title: match.title,
        chunkIndex: match.chunkIndex ?? 0,
        score: match.score,
        snippet: match.snippet,
      })),
    };
  }

  private executeFallbackSearch(
    query: string,
    limit: number
  ): KnowledgeSearchOutput {
    const terms = query
      .toLowerCase()
      .split(/\W+/)
      .filter((term) => term.length >= 2);

    const scored = this.fallbackDocuments
      .map((doc) => {
        const searchableText =
          `${doc.title} ${doc.content} ${doc.tags.join(" ")}`.toLowerCase();
        const score = terms.reduce(
          (acc, term) => (searchableText.includes(term) ? acc + 1 : acc),
          0
        );
        return {
          id: doc.id,
          documentId: doc.id,
          title: doc.title,
          chunkIndex: 0,
          content: doc.content,
          score,
          citation: formatCitationLabel(doc.title, 0),
          snippet: formatSnippetPreview(doc.content),
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      query,
      matches: scored,
      citations: scored.map((match) => ({
        citation: match.citation,
        documentId: match.documentId,
        title: match.title,
        chunkIndex: match.chunkIndex ?? 0,
        score: match.score,
        snippet: match.snippet,
      })),
    };
  }
}
