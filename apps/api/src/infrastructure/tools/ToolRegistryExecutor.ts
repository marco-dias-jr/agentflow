import { ToolDefinition } from "../../application/ports/LLMProvider";
import {
  ToolExecutionResult,
  ToolExecutor,
} from "../../application/ports/ToolExecutor";
import { AgentTool } from "./AgentTool";
import { CalculatorTool } from "./CalculatorTool";
import { KnowledgeSearchTool } from "./KnowledgeSearchTool";

export class ToolRegistryExecutor implements ToolExecutor {
  private readonly tools = new Map<string, AgentTool>();

  constructor(registeredTools?: AgentTool[]) {
    const initialTools = registeredTools ?? [
      new CalculatorTool(),
      new KnowledgeSearchTool(),
    ];

    for (const tool of initialTools) {
      this.tools.set(tool.definition.name, tool);
    }
  }

  public listDefinitions(enabledTools: string[]): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];

    for (const rawName of enabledTools) {
      const normalized = rawName.trim().toLowerCase();
      const tool = this.tools.get(normalized);
      if (tool) {
        definitions.push(tool.definition);
      }
    }

    return definitions;
  }

  public async execute(
    toolName: string,
    args: Record<string, unknown>,
    allowedTools?: string[]
  ): Promise<ToolExecutionResult> {
    const normalized = toolName.trim().toLowerCase();

    if (allowedTools !== undefined) {
      const allowedSet = new Set(
        allowedTools.map((name) => name.trim().toLowerCase())
      );
      if (!allowedSet.has(normalized)) {
        return {
          toolName,
          isError: true,
          output: {
            error: `Tool '${toolName}' is not enabled for this agent execution.`,
          },
        };
      }
    }

    const tool = this.tools.get(normalized);

    if (!tool) {
      return {
        toolName,
        isError: true,
        output: { error: `Unknown or unregistered tool: ${toolName}` },
      };
    }

    try {
      const output = await tool.execute(args);
      return {
        toolName: tool.definition.name,
        isError: false,
        output,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tool execution failed";
      return {
        toolName: tool.definition.name,
        isError: true,
        output: { error: message },
      };
    }
  }
}
