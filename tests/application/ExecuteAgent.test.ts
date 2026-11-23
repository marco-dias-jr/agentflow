import { describe, expect, it } from "vitest";
import { ExecuteAgent } from "../../apps/api/src/application/use-cases/ExecuteAgent";
import {
  GenerateInput,
  GenerateOutput,
  LLMProvider,
} from "../../apps/api/src/application/ports/LLMProvider";
import { Agent } from "../../apps/api/src/domain/entities/Agent";
import { Execution } from "../../apps/api/src/domain/entities/Execution";
import { AgentRepository } from "../../apps/api/src/domain/repositories/AgentRepository";
import { ExecutionRepository } from "../../apps/api/src/domain/repositories/ExecutionRepository";
import { ToolRegistryExecutor } from "../../apps/api/src/infrastructure/tools/ToolRegistryExecutor";

class InMemoryAgentRepository implements AgentRepository {
  public items = new Map<string, Agent>();

  public async save(agent: Agent): Promise<void> {
    this.items.set(agent.id, agent);
  }

  public async findById(id: string): Promise<Agent | null> {
    return this.items.get(id) ?? null;
  }

  public async findAll(): Promise<Agent[]> {
    return Array.from(this.items.values());
  }

  public async deleteById(id: string): Promise<void> {
    this.items.delete(id);
  }
}

class InMemoryExecutionRepository implements ExecutionRepository {
  public items = new Map<string, Execution>();

  public async save(execution: Execution): Promise<void> {
    this.items.set(execution.id, execution);
  }

  public async update(execution: Execution): Promise<void> {
    this.items.set(execution.id, execution);
  }

  public async findById(id: string): Promise<Execution | null> {
    return this.items.get(id) ?? null;
  }

  public async findByAgentId(agentId: string): Promise<Execution[]> {
    return Array.from(this.items.values()).filter((e) => e.agentId === agentId);
  }
}

class ScriptedLLMProvider implements LLMProvider {
  private callCount = 0;

  public async generate(_input: GenerateInput): Promise<GenerateOutput> {
    this.callCount += 1;

    if (this.callCount === 1) {
      return {
        provider: "mock",
        model: "mock-model",
        content: null,
        toolCalls: [
          {
            id: "call-1",
            name: "calculator",
            arguments: { expression: "(10 * 5) + 2" },
          },
        ],
      };
    }

    return {
      provider: "mock",
      model: "mock-model",
      content: "The result is 52.",
      toolCalls: [],
    };
  }
}

describe("ExecuteAgent use case", () => {
  it("executes tool calling loop and records full execution trace", async () => {
    const agentRepo = new InMemoryAgentRepository();
    const executionRepo = new InMemoryExecutionRepository();
    const llmProvider = new ScriptedLLMProvider();
    const toolExecutor = new ToolRegistryExecutor();

    const agent = Agent.create({
      id: "agent-ops",
      name: "Ops Assistant",
      description: "Helps with calculations",
      systemPrompt: "Use tools when needed.",
      model: "mock-model",
      enabledTools: ["calculator"],
    });
    await agentRepo.save(agent);

    const useCase = new ExecuteAgent(
      agentRepo,
      executionRepo,
      llmProvider,
      toolExecutor
    );

    const result = await useCase.execute({
      agentId: agent.id,
      prompt: "Calculate (10 * 5) + 2",
    });

    expect(result.status).toBe("completed");
    expect(result.response).toBe("The result is 52.");
    expect(result.trace.map((step) => step.type)).toEqual([
      "user_message",
      "llm_request",
      "tool_call",
      "tool_result",
      "llm_request",
      "assistant_response",
    ]);
  });
});
