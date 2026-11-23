import { AgentRepository } from "../../domain/repositories/AgentRepository";

export class DeleteAgent {
  constructor(private readonly agentRepository: AgentRepository) {}

  public async execute(agentId: string, userId: string): Promise<void> {
    const normalizedId = agentId.trim();
    if (!normalizedId) {
      throw new Error("Agent id is required.");
    }

    const existing = await this.agentRepository.findByIdForUser(
      normalizedId,
      userId
    );
    if (!existing) {
      throw new Error(`Agent not found: ${normalizedId}`);
    }

    await this.agentRepository.deleteByIdForUser(normalizedId, userId);
  }
}
