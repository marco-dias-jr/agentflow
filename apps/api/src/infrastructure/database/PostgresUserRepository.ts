import { Pool } from "pg";
import { User } from "../../domain/entities/User";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { Cpf } from "../../domain/value-objects/Cpf";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  cpf: string;
  password_hash: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  public async save(user: User): Promise<void> {
    const query = `
      insert into users (id, full_name, email, cpf, password_hash, created_at, updated_at)
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (id) do update set
        full_name = excluded.full_name,
        email = excluded.email,
        cpf = excluded.cpf,
        password_hash = excluded.password_hash,
        updated_at = excluded.updated_at
    `;

    await this.pool.query(query, [
      user.id,
      user.fullName,
      user.email,
      user.cpf,
      user.passwordHash,
      user.createdAt.toISOString(),
      user.updatedAt.toISOString(),
    ]);
  }

  public async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `select id, full_name, email, cpf, password_hash, created_at, updated_at
       from users
       where id = $1`,
      [id]
    );

    const row = result.rows[0];
    return row ? this.mapRowToEntity(row) : null;
  }

  public async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await this.pool.query<UserRow>(
      `select id, full_name, email, cpf, password_hash, created_at, updated_at
       from users
       where email = $1`,
      [normalizedEmail]
    );

    const row = result.rows[0];
    return row ? this.mapRowToEntity(row) : null;
  }

  public async findByCpf(cpf: string): Promise<User | null> {
    const sanitizedCpf = Cpf.sanitize(cpf);
    const result = await this.pool.query<UserRow>(
      `select id, full_name, email, cpf, password_hash, created_at, updated_at
       from users
       where cpf = $1`,
      [sanitizedCpf]
    );

    const row = result.rows[0];
    return row ? this.mapRowToEntity(row) : null;
  }

  private mapRowToEntity(row: UserRow): User {
    return new User({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      cpf: row.cpf,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
