export interface CreateAgentInput {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  enabledTools: string[];
  now?: Date;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  enabledTools?: string[];
  now?: Date;
}

export class Agent {
  public readonly id: string;
  public name: string;
  public description: string;
  public systemPrompt: string;
  public model: string;
  public enabledTools: string[];
  public readonly createdAt: Date;
  public updatedAt: Date;

  private constructor(props: {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    model: string;
    enabledTools: string[];
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.systemPrompt = props.systemPrompt;
    this.model = props.model;
    this.enabledTools = props.enabledTools;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  private static normalizeTools(tools: string[]): string[] {
    return Array.from(
      new Set(tools.map((tool) => tool.trim()).filter(Boolean))
    );
  }

  public static create(input: CreateAgentInput): Agent {
    const name = input.name.trim();
    const systemPrompt = input.systemPrompt.trim();
    const model = input.model.trim();

    if (!input.id.trim()) {
      throw new Error("Agent id is required.");
    }
    if (!name) {
      throw new Error("Agent name is required.");
    }
    if (!systemPrompt) {
      throw new Error("Agent systemPrompt is required.");
    }
    if (!model) {
      throw new Error("Agent model is required.");
    }

    const timestamp = input.now ?? new Date();
    const uniqueTools = Agent.normalizeTools(input.enabledTools);

    return new Agent({
      id: input.id.trim(),
      name,
      description: input.description.trim(),
      systemPrompt,
      model,
      enabledTools: uniqueTools,
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

    this.updatedAt = input.now ?? new Date();
  }
}
