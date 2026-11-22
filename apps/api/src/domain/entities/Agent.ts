export interface CreateAgentInput {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  enabledTools: string[];
  now?: Date;
}

export class Agent {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly systemPrompt: string;
  public readonly model: string;
  public readonly enabledTools: string[];
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

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
    const uniqueTools = Array.from(
      new Set(input.enabledTools.map((tool) => tool.trim()).filter(Boolean))
    );

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
}