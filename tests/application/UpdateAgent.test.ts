import { describe, expect, it } from "vitest";
import { UpdateAgent } from "../../apps/api/src/application/use-cases/UpdateAgent";
import { Agent } from "../../apps/api/src/domain/entities/Agent";
import { AgentRepository } from "../../apps/api/src/domain/repositories/AgentRepository";

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

describe("UpdateAgent use case and Agent.update", () => {
  it("updates name, model, systemPrompt, and deduplicates enabledTools", async () => {
    const repo = new InMemoryAgentRepository();
    const initial = Agent.create({
      id: "agent-1",
      name: "Initial Agent",
      description: "Old description",
      systemPrompt: "Old prompt",
      model: "gemini-2.5-flash",
      enabledTools: ["calculator"],
    });
    await repo.save(initial);

    const useCase = new UpdateAgent(repo);
    const updated = await useCase.execute({
      id: "agent-1",
      name: "  Updated Ops Agent  ",
      description: "  New operational scope  ",
      systemPrompt: "  Always verify runbooks first.  ",
      model: "llama-3.3-70b-versatile",
      enabledTools: ["knowledge_search", "calculator", "knowledge_search"],
    });

    expect(updated.name).toBe("Updated Ops Agent");
    expect(updated.description).toBe("New operational scope");
    expect(updated.systemPrompt).toBe("Always verify runbooks first.");
    expect(updated.model).toBe("llama-3.3-70b-versatile");
    expect(updated.enabledTools).toEqual(["knowledge_search", "calculator"]);

    const persisted = await repo.findById("agent-1");
    expect(persisted?.model).toBe("llama-3.3-70b-versatile");
    expect(persisted?.enabledTools).toEqual(["knowledge_search", "calculator"]);
  });

  it("throws when updating a non-existent agent", async () => {
    const repo = new InMemoryAgentRepository();
    const useCase = new UpdateAgent(repo);

    await expect(
      useCase.execute({
        id: "missing-agent",
        name: "Renamed",
      })
    ).rejects.toThrow("Agent not found: missing-agent");
  });

  it("rejects empty systemPrompt during update", async () => {
    const repo = new InMemoryAgentRepository();
    const agent = Agent.create({
      id: "agent-2",
      name: "Helper",
      description: "",
      systemPrompt: "Be helpful",
      model: "gemini-2.5-flash",
      enabledTools: [],
    });
    await repo.save(agent);

    const useCase = new UpdateAgent(repo);

    await expect(
      useCase.execute({
        id: "agent-2",
        systemPrompt: "   ",
      })
    ).rejects.toThrow("Agent systemPrompt is required.");
  });
});
