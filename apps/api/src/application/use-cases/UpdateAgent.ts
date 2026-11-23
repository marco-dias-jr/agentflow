import { Agent } from "../../domain/entities/Agent";
import { AgentRepository } from "../../domain/repositories/AgentRepository";
import { DocumentRepository } from "../../domain/repositories/DocumentRepository";

export interface UpdateAgentCommand {
  id: string;
  userId: string;
  name?: string;
  description?: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  enabledTools?: string[];
  documentIds?: string[];
}

export class UpdateAgent {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly documentRepository?: DocumentRepository
  ) {}

  public async execute(command: UpdateAgentCommand): Promise<Agent> {
    const agent = await this.agentRepository.findByIdForUser(
      command.id,
      command.userId
    );
    if (!agent) {
      throw new Error(`Agent not found: ${command.id}`);
    }

    if (command.documentIds !== undefined && this.documentRepository) {
      const requestedIds = Array.from(
        new Set(command.documentIds.map((id) => id.trim()).filter(Boolean))
      );
      if (requestedIds.length > 0) {
        const existingIds =
          await this.documentRepository.findExistingIdsForUser(
            command.userId,
            requestedIds
          );
        const existingSet = new Set(existingIds);
        const invalidIds = requestedIds.filter((id) => !existingSet.has(id));
        if (invalidIds.length > 0) {
          throw new Error(
            `Invalid or unauthorized documentIds: ${invalidIds.join(", ")}`
          );
        }
      }
    }

    agent.update({
      name: command.name,
      description: command.description,
      systemPrompt: command.systemPrompt,
      provider: command.provider,
      model: command.model,
      enabledTools: command.enabledTools,
      documentIds: command.documentIds,
    });

    await this.agentRepository.save(agent);

    if (command.documentIds !== undefined && this.documentRepository) {
      await this.documentRepository.setAgentDocuments(
        agent.id,
        command.userId,
        agent.documentIds
      );
    }

    return agent;
  }
}
