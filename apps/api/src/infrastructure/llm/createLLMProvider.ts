import { LLMProvider } from "../../application/ports/LLMProvider";
import { GeminiProvider } from "./GeminiProvider";
import { GroqProvider } from "./GroqProvider";
import { OllamaProvider } from "./OllamaProvider";

export type SupportedLLMProvider = "gemini" | "groq" | "ollama";

export interface LLMProviderEnv {
  LLM_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
}

export function createLLMProvider(env: LLMProviderEnv = process.env): LLMProvider {
  const rawProvider = (env.LLM_PROVIDER ?? "gemini").trim().toLowerCase();

  switch (rawProvider) {
    case "gemini":
      return new GeminiProvider({
        apiKey: env.GEMINI_API_KEY ?? "",
        defaultModel: env.GEMINI_MODEL,
      });

    case "groq":
      return new GroqProvider({
        apiKey: env.GROQ_API_KEY ?? "",
        defaultModel: env.GROQ_MODEL,
      });

    case "ollama":
      return new OllamaProvider({
        baseUrl: env.OLLAMA_BASE_URL,
        defaultModel: env.OLLAMA_MODEL,
      });

    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${rawProvider}`);
  }
}
