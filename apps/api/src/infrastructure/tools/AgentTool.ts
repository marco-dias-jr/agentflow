import { ToolDefinition } from "../../application/ports/LLMProvider";

export interface AgentTool {
  readonly definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<unknown>;
}
