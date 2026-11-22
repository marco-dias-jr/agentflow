import { ToolDefinition } from "../../application/ports/LLMProvider";
import { AgentTool } from "./AgentTool";

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  tags: string[];
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
      "Searches the internal operational knowledge base for runbooks, policies, and troubleshooting guides.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keywords or operational question",
        },
        limit: {
          type: "number",
          description: "Maximum number of matching documents to return (1 to 5)",
        },
      },
      required: ["query"],
    },
  };

  constructor(
    private readonly documents: KnowledgeDocument[] = DEFAULT_KNOWLEDGE_BASE
  ) {}

  public async execute(args: Record<string, unknown>): Promise<{
    query: string;
    matches: Array<{
      id: string;
      title: string;
      content: string;
      score: number;
    }>;
  }> {
    const rawQuery = args.query;
    if (typeof rawQuery !== "string" || !rawQuery.trim()) {
      throw new Error("Invalid argument: 'query' must be a non-empty string.");
    }

    const query = rawQuery.trim();
    const rawLimit = typeof args.limit === "number" ? args.limit : 3;
    const limit = Math.max(1, Math.min(5, Math.floor(rawLimit)));

    const terms = query
      .toLowerCase()
      .split(/\W+/)
      .filter((term) => term.length >= 2);

    const scored = this.documents
      .map((doc) => {
        const searchableText = `${doc.title} ${doc.content} ${doc.tags.join(" ")}`.toLowerCase();
        const score = terms.reduce(
          (acc, term) => (searchableText.includes(term) ? acc + 1 : acc),
          0
        );
        return {
          id: doc.id,
          title: doc.title,
          content: doc.content,
          score,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      query,
      matches: scored,
    };
  }
}
