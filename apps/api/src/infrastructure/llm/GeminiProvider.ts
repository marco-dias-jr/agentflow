import {
  ChatMessage,
  GenerateInput,
  GenerateOutput,
  LLMProvider,
  ToolCallRequest,
  ToolDefinition,
} from "../../application/ports/LLMProvider";

export interface GeminiProviderConfig {
  apiKey: string;
  defaultModel?: string;
  baseUrl?: string;
}

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
}

interface GeminiGenerateResponse {
  candidates?: GeminiCandidate[];
}

export class GeminiProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly baseUrl: string;

  constructor(config: GeminiProviderConfig) {
    if (!config.apiKey.trim()) {
      throw new Error("Gemini API key is required.");
    }
    this.apiKey = config.apiKey.trim();
    this.defaultModel = config.defaultModel?.trim() || "gemini-2.5-flash";
    this.baseUrl =
      config.baseUrl?.trim().replace(/\/+$/, "") ||
      "https://generativelanguage.googleapis.com/v1beta";
  }

  public async generate(input: GenerateInput): Promise<GenerateOutput> {
    const model = input.model.trim() || this.defaultModel;
    const systemInstruction = this.extractSystemInstruction(input.messages);
    const contents = this.mapMessages(input.messages);
    const tools = this.mapTools(input.tools);

    const body: Record<string, unknown> = {
      contents,
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (tools.length > 0) {
      body.tools = [{ functionDeclarations: tools }];
    }

    const endpoint = `${this.baseUrl}/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini API request failed (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as GeminiGenerateResponse;
    const parts = data.candidates?.[0]?.content?.parts ?? [];

    const textParts: string[] = [];
    const toolCalls: ToolCallRequest[] = [];

    parts.forEach((part, index) => {
      if (typeof part.text === "string" && part.text.length > 0) {
        textParts.push(part.text);
      }
      if (part.functionCall?.name) {
        toolCalls.push({
          id: `gemini_call_${index + 1}_${part.functionCall.name}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args ?? {},
        });
      }
    });

    return {
      provider: "gemini",
      model,
      content: textParts.length > 0 ? textParts.join("\n") : null,
      toolCalls,
    };
  }

  private extractSystemInstruction(messages: ChatMessage[]): string | null {
    const systemMessages = messages
      .filter((m) => m.role === "system" && m.content.trim().length > 0)
      .map((m) => m.content.trim());

    return systemMessages.length > 0 ? systemMessages.join("\n\n") : null;
  }

  private mapMessages(messages: ChatMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        continue;
      }

      if (msg.role === "user") {
        contents.push({
          role: "user",
          parts: [{ text: msg.content }],
        });
        continue;
      }

      if (msg.role === "assistant") {
        contents.push({
          role: "model",
          parts: [{ text: msg.content }],
        });
        continue;
      }

      if (msg.role === "tool") {
        const toolName = msg.toolName || "tool";
        let parsedResponse: Record<string, unknown>;
        try {
          const parsed = JSON.parse(msg.content);
          parsedResponse =
            typeof parsed === "object" && parsed !== null
              ? (parsed as Record<string, unknown>)
              : { result: parsed };
        } catch {
          parsedResponse = { result: msg.content };
        }

        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: toolName,
                response: parsedResponse,
              },
            },
          ],
        });
      }
    }

    return contents;
  }

  private mapTools(tools?: ToolDefinition[]): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    if (!tools || tools.length === 0) {
      return [];
    }

    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
}
