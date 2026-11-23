import { Execution } from "../../domain/entities/Execution";
import { ExecutionRepository } from "../../domain/repositories/ExecutionRepository";

export class GetExecutionHistory {
  constructor(private readonly executionRepository: ExecutionRepository) {}

  public async execute(agentId: string, userId: string): Promise<Execution[]> {
    if (!agentId.trim()) {
      throw new Error("Agent id is required.");
    }
    if (!userId.trim()) {
      throw new Error("User id is required.");
    }
    return this.executionRepository.findByAgentIdForUser(
      agentId.trim(),
      userId.trim()
    );
  }
}
