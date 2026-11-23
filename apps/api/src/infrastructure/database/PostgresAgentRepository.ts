import { Pool } from "pg";
import { Agent } from "../../domain/entities/Agent";
import { AgentRepository } from "../../domain/repositories/AgentRepository";

interface AgentRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  system_prompt: string;
  provider: string | null;
  model: string;
  enabled_tools: string[] | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export class PostgresAgentRepository implements AgentRepository {
  constructor(private readonly pool: Pool) {}

  public async save(agent: Agent): Promise<void> {
    const query = `
      insert into agents (id, user_id, name, description, system_prompt, provider, model, enabled_tools, created_at, updated_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
      on conflict (id) do update set
        name = excluded.name,
        description = excluded.description,
        system_prompt = excluded.system_prompt,
        provider = excluded.provider,
        model = excluded.model,
        enabled_tools = excluded.enabled_tools,
        updated_at = excluded.updated_at
    `;

    await this.pool.query(query, [
      agent.id,
      agent.userId,
      agent.name,
      agent.description,
      agent.systemPrompt,
      agent.provider,
      agent.model,
      JSON.stringify(agent.enabledTools),
      agent.createdAt.toISOString(),
      agent.updatedAt.toISOString(),
    ]);
  }

  public async findByIdForUser(
    id: string,
    userId: string
  ): Promise<Agent | null> {
    const result = await this.pool.query<AgentRow>(
      `select id, user_id, name, description, system_prompt, provider, model, enabled_tools, created_at, updated_at
       from agents
       where id = $1 and user_id = $2`,
      [id, userId]
    );

    const row = result.rows[0];
    return row ? this.mapRowToEntity(row) : null;
  }

  public async findAllByUserId(userId: string): Promise<Agent[]> {
    const result = await this.pool.query<AgentRow>(
      `select id, user_id, name, description, system_prompt, provider, model, enabled_tools, created_at, updated_at
       from agents
       where user_id = $1
       order by created_at desc`,
      [userId]
    );

    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  public async deleteByIdForUser(id: string, userId: string): Promise<void> {
    await this.pool.query(
      `delete from agents where id = $1 and user_id = $2`,
      [id, userId]
    );
  }

  private mapRowToEntity(row: AgentRow): Agent {
    const tools = Array.isArray(row.enabled_tools)
      ? row.enabled_tools
      : typeof row.enabled_tools === "string"
        ? (JSON.parse(row.enabled_tools) as string[])
        : [];

    const fallbackProvider = (process.env.LLM_PROVIDER ?? "gemini").trim() || "gemini";
    const agent = Agent.create({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      systemPrompt: row.system_prompt,
      provider: row.provider?.trim() || fallbackProvider,
      model: row.model,
      enabledTools: tools,
      now: new Date(row.created_at),
    });

    agent.updatedAt = new Date(row.updated_at);
    return agent;
  }
}
