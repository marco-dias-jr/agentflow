export interface AgentProps {
  id: string;
  userId: string;
  name: string;
  description: string;
  systemPrompt: string;
  provider: string;
  model: string;
  enabledTools: string[];
  documentIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentInput {
  id: string;
  userId: string;
  name: string;
  description: string;
  systemPrompt: string;
  provider: string;
  model: string;
  enabledTools: string[];
  documentIds?: string[];
  now?: Date;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  enabledTools?: string[];
  documentIds?: string[];
  now?: Date;
}

export class Agent {
  public readonly id: string;
  public readonly userId: string;
  public name: string;
  public description: string;
  public systemPrompt: string;
  public provider: string;
  public model: string;
  public enabledTools: string[];
  public documentIds: string[];
  public readonly createdAt: Date;
  public updatedAt: Date;

  private constructor(props: AgentProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.description = props.description;
    this.systemPrompt = props.systemPrompt;
    this.provider = props.provider;
    this.model = props.model;
    this.enabledTools = props.enabledTools;
    this.documentIds = Agent.normalizeDocumentIds(props.documentIds);
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  private static normalizeTools(tools: string[]): string[] {
    return Array.from(
      new Set(tools.map((tool) => tool.trim()).filter(Boolean))
    );
  }

  private static normalizeDocumentIds(documentIds?: string[]): string[] {
    return Array.from(
      new Set((documentIds ?? []).map((id) => id.trim()).filter(Boolean))
    );
  }

  public static create(input: CreateAgentInput): Agent {
    const name = input.name.trim();
    const systemPrompt = input.systemPrompt.trim();
    const provider = input.provider.trim().toLowerCase();
    const model = input.model.trim();

    if (!input.id.trim()) {
      throw new Error("Agent id is required.");
    }
    if (!input.userId || !input.userId.trim()) {
      throw new Error("Agent userId is required.");
    }
    if (!name) {
      throw new Error("Agent name is required.");
    }
    if (!systemPrompt) {
      throw new Error("Agent systemPrompt is required.");
    }
    if (!provider) {
      throw new Error("Agent provider is required.");
    }
    if (!model) {
      throw new Error("Agent model is required.");
    }

    const timestamp = input.now ?? new Date();
    const uniqueTools = Agent.normalizeTools(input.enabledTools);
    const uniqueDocumentIds = Agent.normalizeDocumentIds(input.documentIds);

    return new Agent({
      id: input.id.trim(),
      userId: input.userId.trim(),
      name,
      description: input.description.trim(),
      systemPrompt,
      provider,
      model,
      enabledTools: uniqueTools,
      documentIds: uniqueDocumentIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  public update(input: UpdateAgentInput): void {
    if (input.name !== undefined) {
      const normalizedName = input.name.trim();
      if (!normalizedName) {
        throw new Error("Agent name is required.");
      }
      this.name = normalizedName;
    }

    if (input.description !== undefined) {
      this.description = input.description.trim();
    }

    if (input.systemPrompt !== undefined) {
      const normalizedPrompt = input.systemPrompt.trim();
      if (!normalizedPrompt) {
        throw new Error("Agent systemPrompt is required.");
      }
      this.systemPrompt = normalizedPrompt;
    }

    if (input.provider !== undefined) {
      const normalizedProvider = input.provider.trim().toLowerCase();
      if (!normalizedProvider) {
        throw new Error("Agent provider is required.");
      }
      this.provider = normalizedProvider;
    }

    if (input.model !== undefined) {
      const normalizedModel = input.model.trim();
      if (!normalizedModel) {
        throw new Error("Agent model is required.");
      }
      this.model = normalizedModel;
    }

    if (input.enabledTools !== undefined) {
      this.enabledTools = Agent.normalizeTools(input.enabledTools);
    }

    if (input.documentIds !== undefined) {
      this.documentIds = Agent.normalizeDocumentIds(input.documentIds);
    }

    this.updatedAt = input.now ?? new Date();
  }
}
