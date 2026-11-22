import {
  ChatMessage,
  GenerateInput,
  GenerateOutput,
  LLMProvider,
  ToolCallRequest,
  ToolDefinition,
} from "../../application/ports/LLMProvider";

export interface OllamaProviderConfig {
  baseUrl?: string;
  defaultModel?: string;
}

interface OllamaToolCall {
  function?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
}

interface OllamaChatResponse {
  message?: {
    content?: string;
    tool_calls?: OllamaToolCall[];
  };
}

export class OllamaProvider implements LLMProvider {
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: OllamaProviderConfig = {}) {
    this.baseUrl =
      config.baseUrl?.trim().replace(/\/+$/, "") || "http://localhost:11434";
    this.defaultModel = config.defaultModel?.trim() || "qwen2.5:3b";
  }

  public async generate(input: GenerateInput): Promise<GenerateOutput> {
    const model = input.model.trim() || this.defaultModel;
    const messages = this.mapMessages(input.messages);
    const tools = this.mapTools(input.tools);

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };

    if (tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama request failed (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as OllamaChatResponse;
    const rawToolCalls = data.message?.tool_calls ?? [];

    const toolCalls: ToolCallRequest[] = rawToolCalls
      .filter((call) => Boolean(call.function?.name))
      .map((call, index) => ({
        id: `ollama_call_${index + 1}_${call.function!.name}`,
        name: call.function!.name!,
        arguments: call.function?.arguments ?? {},
      }));

    const content = data.message?.content ?? null;

    return {
      provider: "ollama",
      model,
      content: content && content.length > 0 ? content : null,
      toolCalls,
    };
  }

  private mapMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
    return messages.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "tool",
          content: msg.content,
        };
      }

      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }

  private mapTools(tools?: ToolDefinition[]): Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    if (!tools || tools.length === 0) {
      return [];
    }

    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}
