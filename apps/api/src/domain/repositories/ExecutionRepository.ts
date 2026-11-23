import { Execution } from "../entities/Execution";

export interface ExecutionRepository {
  save(execution: Execution): Promise<void>;
  update(execution: Execution): Promise<void>;
  findByIdForUser(id: string, userId: string): Promise<Execution | null>;
  findByAgentIdForUser(agentId: string, userId: string): Promise<Execution[]>;
}
