import { describe, expect, it } from "vitest";
import { DeleteAgent } from "../../apps/api/src/application/use-cases/DeleteAgent";
import { Agent } from "../../apps/api/src/domain/entities/Agent";
import { AgentRepository } from "../../apps/api/src/domain/repositories/AgentRepository";

class InMemoryAgentRepository implements AgentRepository {
  public items = new Map<string, Agent>();

  public async save(agent: Agent): Promise<void> {
    this.items.set(agent.id, agent);
  }

  public async findByIdForUser(
    id: string,
    userId: string
  ): Promise<Agent | null> {
    const agent = this.items.get(id);
    return agent && agent.userId === userId ? agent : null;
  }

  public async findAllByUserId(userId: string): Promise<Agent[]> {
    return Array.from(this.items.values()).filter((a) => a.userId === userId);
  }

  public async deleteByIdForUser(id: string, userId: string): Promise<void> {
    const agent = this.items.get(id);
    if (agent && agent.userId === userId) {
      this.items.delete(id);
    }
  }
}

describe("DeleteAgent use case", () => {
  it("deletes an existing agent from the repository", async () => {
    const repo = new InMemoryAgentRepository();
    const agent = Agent.create({
      id: "agent-delete-1",
      userId: "user-1",
      name: "Temporary Agent",
      description: "To be deleted",
      systemPrompt: "Temporary prompt",
      provider: "gemini",
      model: "gemini-2.5-flash",
      enabledTools: ["calculator"],
    });
    await repo.save(agent);

    const deleteAgent = new DeleteAgent(repo);
    await deleteAgent.execute("agent-delete-1", "user-1");

    expect(await repo.findByIdForUser("agent-delete-1", "user-1")).toBeNull();
    expect(await repo.findAllByUserId("user-1")).toHaveLength(0);
  });

  it("throws when attempting to delete a non-existent agent", async () => {
    const repo = new InMemoryAgentRepository();
    const deleteAgent = new DeleteAgent(repo);

    await expect(deleteAgent.execute("missing-id", "user-1")).rejects.toThrow(
      "Agent not found: missing-id"
    );
  });

  it("rejects blank agent id", async () => {
    const repo = new InMemoryAgentRepository();
    const deleteAgent = new DeleteAgent(repo);

    await expect(deleteAgent.execute("   ", "user-1")).rejects.toThrow(
      "Agent id is required."
    );
  });
});
