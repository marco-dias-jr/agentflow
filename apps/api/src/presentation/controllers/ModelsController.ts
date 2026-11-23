import { Controller, Get } from "@nestjs/common";

export interface ModelOption {
  id: string;
  label: string;
  provider: "gemini" | "groq" | "ollama";
}

function parseEnvModels(
  rawValue: string | undefined,
  provider: "gemini" | "groq" | "ollama",
  providerLabel: string,
  out: ModelOption[],
  seen: Set<string>
): void {
  if (!rawValue) return;

  for (const item of rawValue.split(",")) {
    const modelId = item.trim();
    if (!modelId) continue;

    const key = `${provider}:${modelId}`;
    if (seen.has(key)) continue;

    seen.add(key);
    out.push({
      id: modelId,
      label: `${modelId} (${providerLabel})`,
      provider,
    });
  }
}

@Controller("models")
export class ModelsController {
  @Get()
  public listAvailableModels() {
    const models: ModelOption[] = [];
    const seen = new Set<string>();
    const activeProvider = (process.env.LLM_PROVIDER ?? "")
      .trim()
      .toLowerCase();

    parseEnvModels(process.env.GEMINI_MODEL, "gemini", "Gemini", models, seen);
    parseEnvModels(process.env.GROQ_MODEL, "groq", "Groq", models, seen);
    parseEnvModels(process.env.OLLAMA_MODEL, "ollama", "Ollama", models, seen);

    return {
      data: {
        activeProvider,
        models,
      },
    };
  }
}
