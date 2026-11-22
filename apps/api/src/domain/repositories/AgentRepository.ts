import { Agent } from "../entities/Agent";

export interface AgentRepository {
  save(agent: Agent): Promise<void>;
  findById(id: string): Promise<Agent | null>;
  findAll(): Promise<Agent[]>;
  deleteById(id: string): Promise<void>;
}
