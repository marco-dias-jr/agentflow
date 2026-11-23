export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface GenerateInput {
  provider?: string;
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
}

export interface GenerateOutput {
  provider: string;
  model: string;
  content: string | null;
  toolCalls: ToolCallRequest[];
}

export interface LLMProvider {
  generate(input: GenerateInput): Promise<GenerateOutput>;
}
