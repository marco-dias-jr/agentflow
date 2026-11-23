import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../security/AuthGuard";

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  providerLabel: string;
}

function parseEnvModels(
  rawValue: string | undefined,
  provider: string,
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
      label: modelId,
      provider,
      providerLabel,
    });
  }
}

@Controller("models")
@UseGuards(AuthGuard)
export class ModelsController {
  @Get()
  public listAvailableModels() {
    const models: ModelOption[] = [];
    const seen = new Set<string>();

    if (process.env.GEMINI_API_KEY?.trim()) {
      parseEnvModels(process.env.GEMINI_MODEL, "gemini", "Gemini", models, seen);
    }

    if (process.env.GROQ_API_KEY?.trim()) {
      parseEnvModels(process.env.GROQ_MODEL, "groq", "Groq", models, seen);
    }

    if (process.env.OLLAMA_MODEL?.trim() || process.env.OLLAMA_BASE_URL?.trim()) {
      parseEnvModels(process.env.OLLAMA_MODEL, "ollama", "Ollama", models, seen);
    }

    return {
      data: {
        models,
      },
    };
  }
}
