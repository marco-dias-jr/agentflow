import { describe, expect, it } from "vitest";
import {
  GenerateInput,
  GenerateOutput,
  LLMProvider,
} from "../../apps/api/src/application/ports/LLMProvider";
import { LLMProviderRouter } from "../../apps/api/src/infrastructure/llm/LLMProviderRouter";

class StubProvider implements LLMProvider {
  constructor(private readonly name: string) {}

  public async generate(input: GenerateInput): Promise<GenerateOutput> {
    return {
      provider: this.name,
      model: input.model,
      content: `reply from ${this.name}`,
      toolCalls: [],
    };
  }
}

describe("LLMProviderRouter", () => {
  it("routes generation requests to the matching provider adapter", async () => {
    const router = new LLMProviderRouter({
      gemini: new StubProvider("gemini"),
      ollama: new StubProvider("ollama"),
    });

    const ollamaReply = await router.generate({
      provider: "ollama",
      model: "qwen2.5:3b",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(ollamaReply.provider).toBe("ollama");
    expect(ollamaReply.content).toBe("reply from ollama");

    const geminiReply = await router.generate({
      provider: "gemini",
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(geminiReply.provider).toBe("gemini");
    expect(geminiReply.content).toBe("reply from gemini");
  });

  it("throws a clear error when requested provider is not configured", async () => {
    const router = new LLMProviderRouter({
      gemini: new StubProvider("gemini"),
    });

    await expect(
      router.generate({
        provider: "ollama",
        model: "qwen2.5:3b",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow("LLM provider 'ollama' is not configured.");
  });
});
