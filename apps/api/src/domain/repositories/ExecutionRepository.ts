import { Execution } from "../entities/Execution";

export interface ExecutionRepository {
  save(execution: Execution): Promise<void>;
  update(execution: Execution): Promise<void>;
  findById(id: string): Promise<Execution | null>;
  findByAgentId(agentId: string): Promise<Execution[]>;
}
