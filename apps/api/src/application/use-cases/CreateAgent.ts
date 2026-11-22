import { randomUUID } from "crypto";
import { Agent } from "../../domain/entities/Agent";
import { AgentRepository } from "../../domain/repositories/AgentRepository";

export interface CreateAgentCommand {
  name: string;
  description?: string;
  systemPrompt: string;
  model: string;
  enabledTools?: string[];
}

export class CreateAgent {
  constructor(private readonly agentRepository: AgentRepository) {}

  public async execute(command: CreateAgentCommand): Promise<Agent> {
    const agent = Agent.create({
      id: randomUUID(),
      name: command.name,
      description: command.description ?? "",
      systemPrompt: command.systemPrompt,
      model: command.model,
      enabledTools: command.enabledTools ?? [],
    });

    await this.agentRepository.save(agent);
    return agent;
  }
}
