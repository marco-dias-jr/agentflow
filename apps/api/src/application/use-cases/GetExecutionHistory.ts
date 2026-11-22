import { Execution } from "../../domain/entities/Execution";
import { ExecutionRepository } from "../../domain/repositories/ExecutionRepository";

export class GetExecutionHistory {
  constructor(private readonly executionRepository: ExecutionRepository) {}

  public async execute(agentId: string): Promise<Execution[]> {
    if (!agentId.trim()) {
      throw new Error("Agent id is required.");
    }
    return this.executionRepository.findByAgentId(agentId.trim());
  }
}
