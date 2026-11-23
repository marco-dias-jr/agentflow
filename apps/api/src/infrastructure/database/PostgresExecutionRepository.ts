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
  user_id: string;
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
      insert into executions (id, agent_id, user_id, provider, model, prompt, status, response, trace, created_at, completed_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
    `;

    await this.pool.query(query, [
      execution.id,
      execution.agentId,
      execution.userId,
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
      set status = $3,
          response = $4,
          trace = $5::jsonb,
          completed_at = $6
      where id = $1 and user_id = $2
    `;

    await this.pool.query(query, [
      execution.id,
      execution.userId,
      execution.status,
      execution.response,
      JSON.stringify(execution.trace),
      execution.completedAt ? execution.completedAt.toISOString() : null,
    ]);
  }

  public async findByIdForUser(
    id: string,
    userId: string
  ): Promise<Execution | null> {
    const result = await this.pool.query<ExecutionRow>(
      `select id, agent_id, user_id, provider, model, prompt, status, response, trace, created_at, completed_at
       from executions
       where id = $1 and user_id = $2`,
      [id, userId]
    );

    const row = result.rows[0];
    return row ? this.mapRowToEntity(row) : null;
  }

  public async findByAgentIdForUser(
    agentId: string,
    userId: string
  ): Promise<Execution[]> {
    const result = await this.pool.query<ExecutionRow>(
      `select id, agent_id, user_id, provider, model, prompt, status, response, trace, created_at, completed_at
       from executions
       where agent_id = $1 and user_id = $2
       order by created_at desc`,
      [agentId, userId]
    );

    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  private mapRowToEntity(row: ExecutionRow): Execution {
    const execution = Execution.start({
      id: row.id,
      agentId: row.agent_id,
      userId: row.user_id,
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
