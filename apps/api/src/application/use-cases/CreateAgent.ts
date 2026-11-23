import { randomUUID } from "crypto";
import { Agent } from "../../domain/entities/Agent";
import { AgentRepository } from "../../domain/repositories/AgentRepository";
import { DocumentRepository } from "../../domain/repositories/DocumentRepository";

export interface CreateAgentCommand {
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  provider: string;
  model: string;
  enabledTools?: string[];
  documentIds?: string[];
}

export class CreateAgent {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly documentRepository?: DocumentRepository
  ) {}

  public async execute(command: CreateAgentCommand): Promise<Agent> {
    const agent = Agent.create({
      id: randomUUID(),
      userId: command.userId,
      name: command.name,
      description: command.description ?? "",
      systemPrompt: command.systemPrompt,
      provider: command.provider,
      model: command.model,
      enabledTools: command.enabledTools ?? [],
      documentIds: command.documentIds ?? [],
    });

    if (agent.documentIds.length > 0 && this.documentRepository) {
      const existingIds = await this.documentRepository.findExistingIdsForUser(
        command.userId,
        agent.documentIds
      );
      const existingSet = new Set(existingIds);
      const invalidIds = agent.documentIds.filter((id) => !existingSet.has(id));
      if (invalidIds.length > 0) {
        throw new Error(
          `Invalid or unauthorized documentIds: ${invalidIds.join(", ")}`
        );
      }
    }

    await this.agentRepository.save(agent);

    if (this.documentRepository && agent.documentIds.length > 0) {
      await this.documentRepository.setAgentDocuments(
        agent.id,
        command.userId,
        agent.documentIds
      );
    }

    return agent;
  }
}
