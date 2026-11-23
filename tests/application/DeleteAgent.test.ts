import { describe, expect, it } from "vitest";
import { DeleteAgent } from "../../apps/api/src/application/use-cases/DeleteAgent";
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

describe("DeleteAgent use case", () => {
  it("deletes an existing agent from the repository", async () => {
    const repo = new InMemoryAgentRepository();
    const agent = Agent.create({
      id: "agent-delete-1",
      name: "Temporary Agent",
      description: "To be deleted",
      systemPrompt: "Temporary prompt",
      model: "gemini-2.5-flash",
      enabledTools: ["calculator"],
    });
    await repo.save(agent);

    const deleteAgent = new DeleteAgent(repo);
    await deleteAgent.execute("agent-delete-1");

    expect(await repo.findById("agent-delete-1")).toBeNull();
    expect(await repo.findAll()).toHaveLength(0);
  });

  it("throws when attempting to delete a non-existent agent", async () => {
    const repo = new InMemoryAgentRepository();
    const deleteAgent = new DeleteAgent(repo);

    await expect(deleteAgent.execute("missing-id")).rejects.toThrow(
      "Agent not found: missing-id"
    );
  });

  it("rejects blank agent id", async () => {
    const repo = new InMemoryAgentRepository();
    const deleteAgent = new DeleteAgent(repo);

    await expect(deleteAgent.execute("   ")).rejects.toThrow(
      "Agent id is required."
    );
  });
});
