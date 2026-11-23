import { Agent } from "../entities/Agent";

export interface AgentRepository {
  save(agent: Agent): Promise<void>;
  findByIdForUser(id: string, userId: string): Promise<Agent | null>;
  findAllByUserId(userId: string): Promise<Agent[]>;
  deleteByIdForUser(id: string, userId: string): Promise<void>;
}
