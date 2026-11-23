import { ToolDefinition } from "./LLMProvider";

export interface ToolExecutionContext {
  userId: string;
  agentId: string;
  documentIds?: string[];
}

export interface ToolExecutionResult {
  toolName: string;
  output: unknown;
  isError?: boolean;
}

export interface ToolExecutor {
  listDefinitions(enabledTools: string[]): ToolDefinition[];
  execute(
    toolName: string,
    args: Record<string, unknown>,
    allowedTools?: string[],
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult>;
}
