import { Agent } from "../../domain/entities/Agent";
import { AgentRepository } from "../../domain/repositories/AgentRepository";

export interface UpdateAgentCommand {
  id: string;
  userId: string;
  name?: string;
  description?: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  enabledTools?: string[];
}

export class UpdateAgent {
  constructor(private readonly agentRepository: AgentRepository) {}

  public async execute(command: UpdateAgentCommand): Promise<Agent> {
    const agent = await this.agentRepository.findByIdForUser(
      command.id,
      command.userId
    );
    if (!agent) {
      throw new Error(`Agent not found: ${command.id}`);
    }

    agent.update({
      name: command.name,
      description: command.description,
      systemPrompt: command.systemPrompt,
      provider: command.provider,
      model: command.model,
      enabledTools: command.enabledTools,
    });

    await this.agentRepository.save(agent);
    return agent;
  }
}
