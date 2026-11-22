import { Pool } from "pg";
import {
  Execution,
  ExecutionStatus,
  TraceStep,
} from "../../domain/entities/Execution";
import { ExecutionRepository } from "../../domain/repositories/ExecutionRepository";

interface ExecutionRow {
  id: string;
  agent_id: string;
  provider: string;
  model: string;
  prompt: string;
  status: ExecutionStatus;
  response: string | null;
  trace: TraceStep[] | string;
  created_at: Date | string;
  completed_at: Date | string | null;
}

export class PostgresExecutionRepository implements ExecutionRepository {
  constructor(private readonly pool: Pool) {}

  public async save(execution: Execution): Promise<void> {
    const query = `
      insert into executions (id, agent_id, provider, model, prompt, status, response, trace, created_at, completed_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
    `;

    await this.pool.query(query, [
      execution.id,
      execution.agentId,
      execution.provider,
      execution.model,
      execution.prompt,
      execution.status,
      execution.response,
      JSON.stringify(execution.trace),
      execution.createdAt.toISOString(),
      execution.completedAt ? execution.completedAt.toISOString() : null,
    ]);
  }

  public async update(execution: Execution): Promise<void> {
    const query = `
      update executions
      set status = $2,
          response = $3,
          trace = $4::jsonb,
          completed_at = $5
      where id = $1
    `;

    await this.pool.query(query, [
      execution.id,
      execution.status,
      execution.response,
      JSON.stringify(execution.trace),
      execution.completedAt ? execution.completedAt.toISOString() : null,
    ]);
  }

  public async findById(id: string): Promise<Execution | null> {
    const result = await this.pool.query<ExecutionRow>(
      `select id, agent_id, provider, model, prompt, status, response, trace, created_at, completed_at
       from executions
       where id = $1`,
      [id]
    );

    const row = result.rows[0];
    return row ? this.mapRowToEntity(row) : null;
  }

  public async findByAgentId(agentId: string): Promise<Execution[]> {
    const result = await this.pool.query<ExecutionRow>(
      `select id, agent_id, provider, model, prompt, status, response, trace, created_at, completed_at
       from executions
       where agent_id = $1
       order by created_at desc`,
      [agentId]
    );

    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  private mapRowToEntity(row: ExecutionRow): Execution {
    const execution = Execution.start({
      id: row.id,
      agentId: row.agent_id,
      provider: row.provider,
      model: row.model,
      prompt: row.prompt,
      now: new Date(row.created_at),
    });

    const parsedTrace = Array.isArray(row.trace)
      ? row.trace
      : typeof row.trace === "string"
        ? (JSON.parse(row.trace) as TraceStep[])
        : [];

    execution.status = row.status;
    execution.response = row.response;
    execution.trace = parsedTrace;
    execution.completedAt = row.completed_at ? new Date(row.completed_at) : null;

    return execution;
  }
}
