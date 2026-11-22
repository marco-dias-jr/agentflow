import { Pool } from "pg";
import { Agent } from "../../domain/entities/Agent";
import { AgentRepository } from "../../domain/repositories/AgentRepository";

interface AgentRow {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  model: string;
  enabled_tools: string[] | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export class PostgresAgentRepository implements AgentRepository {
  constructor(private readonly pool: Pool) {}

  public async save(agent: Agent): Promise<void> {
    const query = `
      insert into agents (id, name, description, system_prompt, model, enabled_tools, created_at, updated_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
      on conflict (id) do update set
        name = excluded.name,
        description = excluded.description,
        system_prompt = excluded.system_prompt,
        model = excluded.model,
        enabled_tools = excluded.enabled_tools,
        updated_at = excluded.updated_at
    `;

    await this.pool.query(query, [
      agent.id,
      agent.name,
      agent.description,
      agent.systemPrompt,
      agent.model,
      JSON.stringify(agent.enabledTools),
      agent.createdAt.toISOString(),
      agent.updatedAt.toISOString(),
    ]);
  }

  public async findById(id: string): Promise<Agent | null> {
    const result = await this.pool.query<AgentRow>(
      `select id, name, description, system_prompt, model, enabled_tools, created_at, updated_at
       from agents
       where id = $1`,
      [id]
    );

    const row = result.rows[0];
    return row ? this.mapRowToEntity(row) : null;
  }

  public async findAll(): Promise<Agent[]> {
    const result = await this.pool.query<AgentRow>(
      `select id, name, description, system_prompt, model, enabled_tools, created_at, updated_at
       from agents
       order by created_at desc`
    );

    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  public async deleteById(id: string): Promise<void> {
    await this.pool.query(`delete from agents where id = $1`, [id]);
  }

  private mapRowToEntity(row: AgentRow): Agent {
    const tools = Array.isArray(row.enabled_tools)
      ? row.enabled_tools
      : typeof row.enabled_tools === "string"
        ? (JSON.parse(row.enabled_tools) as string[])
        : [];

    return Agent.create({
      id: row.id,
      name: row.name,
      description: row.description,
      systemPrompt: row.system_prompt,
      model: row.model,
      enabledTools: tools,
      now: new Date(row.created_at),
    });
  }
}
