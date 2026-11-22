import {
  ChatMessage,
  GenerateInput,
  GenerateOutput,
  LLMProvider,
  ToolCallRequest,
  ToolDefinition,
} from "../../application/ports/LLMProvider";

export interface GroqProviderConfig {
  apiKey: string;
  defaultModel?: string;
  baseUrl?: string;
}

interface GroqToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface GroqChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: GroqToolCall[];
    };
  }>;
}

export class GroqProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly baseUrl: string;

  constructor(config: GroqProviderConfig) {
    if (!config.apiKey.trim()) {
      throw new Error("Groq API key is required.");
    }
    this.apiKey = config.apiKey.trim();
    this.defaultModel = config.defaultModel?.trim() || "llama-3.3-70b-versatile";
    this.baseUrl =
      config.baseUrl?.trim().replace(/\/+$/, "") ||
      "https://api.groq.com/openai/v1";
  }

  public async generate(input: GenerateInput): Promise<GenerateOutput> {
    const model = input.model.trim() || this.defaultModel;
    const messages = this.mapMessages(input.messages);
    const tools = this.mapTools(input.tools);

    const body: Record<string, unknown> = {
      model,
      messages,
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Groq API request failed (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as GroqChatCompletionResponse;
    const message = data.choices?.[0]?.message;
    const rawToolCalls = message?.tool_calls ?? [];

    const toolCalls: ToolCallRequest[] = rawToolCalls.map((call, index) => {
      let parsedArgs: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(call.function.arguments || "{}");
        if (typeof parsed === "object" && parsed !== null) {
          parsedArgs = parsed as Record<string, unknown>;
        }
      } catch {
        parsedArgs = {};
      }

      return {
        id: call.id || `groq_call_${index + 1}`,
        name: call.function.name,
        arguments: parsedArgs,
      };
    });

    return {
      provider: "groq",
      model,
      content: message?.content ?? null,
      toolCalls,
    };
  }

  private mapMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
    return messages.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "tool",
          tool_call_id: msg.toolCallId ?? "unknown_tool_call",
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
