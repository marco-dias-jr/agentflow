import { ToolDefinition } from "./LLMProvider";

export interface ToolExecutionResult {
  toolName: string;
  output: unknown;
  isError?: boolean;
}

export interface ToolExecutor {
  listDefinitions(enabledTools: string[]): ToolDefinition[];
  execute(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolExecutionResult>;
}
