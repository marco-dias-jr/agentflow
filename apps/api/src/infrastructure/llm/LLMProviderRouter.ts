import {
  GenerateInput,
  GenerateOutput,
  LLMProvider,
} from "../../application/ports/LLMProvider";
import { LLMProviderEnv } from "./createLLMProvider";
import { GeminiProvider } from "./GeminiProvider";
import { GroqProvider } from "./GroqProvider";
import { OllamaProvider } from "./OllamaProvider";

export class LLMProviderRouter implements LLMProvider {
  private readonly providers: Map<string, LLMProvider>;
  private readonly defaultProvider: string;

  constructor(
    providers: Record<string, LLMProvider> | Map<string, LLMProvider>,
    defaultProvider = ""
  ) {
    this.providers =
      providers instanceof Map
        ? new Map(
            Array.from(providers.entries()).map(([key, value]) => [
              key.trim().toLowerCase(),
              value,
            ])
          )
        : new Map(
            Object.entries(providers).map(([key, value]) => [
              key.trim().toLowerCase(),
              value,
            ])
          );
    this.defaultProvider = defaultProvider.trim().toLowerCase();
  }

  public async generate(input: GenerateInput): Promise<GenerateOutput> {
    const providerKey = (input.provider ?? this.defaultProvider)
      .trim()
      .toLowerCase();

    if (!providerKey) {
      throw new Error("LLM provider is required for generation.");
    }

    const adapter = this.providers.get(providerKey);
    if (!adapter) {
      const configured = Array.from(this.providers.keys()).join(", ") || "none";
      throw new Error(
        `LLM provider '${providerKey}' is not configured. Available providers: ${configured}.`
      );
    }

    return adapter.generate(input);
  }
}

export function createLLMProviderRouter(
  env: LLMProviderEnv = process.env
): LLMProvider {
  const providers = new Map<string, LLMProvider>();

  if (env.GEMINI_API_KEY?.trim()) {
    providers.set(
      "gemini",
      new GeminiProvider({
        apiKey: env.GEMINI_API_KEY,
        defaultModel: env.GEMINI_MODEL,
      })
    );
  }

  if (env.GROQ_API_KEY?.trim()) {
    providers.set(
      "groq",
      new GroqProvider({
        apiKey: env.GROQ_API_KEY,
        defaultModel: env.GROQ_MODEL,
      })
    );
  }

  if (env.OLLAMA_MODEL?.trim() || env.OLLAMA_BASE_URL?.trim()) {
    providers.set(
      "ollama",
      new OllamaProvider({
        baseUrl: env.OLLAMA_BASE_URL,
        defaultModel: env.OLLAMA_MODEL,
      })
    );
  }

  return new LLMProviderRouter(providers, env.LLM_PROVIDER ?? "");
}
