import { ToolDefinition } from "../../application/ports/LLMProvider";
import { ToolExecutionContext } from "../../application/ports/ToolExecutor";

export interface AgentTool {
  readonly definition: ToolDefinition;
  execute(
    args: Record<string, unknown>,
    context?: ToolExecutionContext
  ): Promise<unknown>;
}
