import { Pool } from "pg";
import {
  AuthRepository,
  PasswordResetCodeRecord,
  SessionRecord,
} from "../../domain/repositories/AuthRepository";

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  user_agent: string | null;
  ip_address: string | null;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  created_at: Date | string;
}

interface ResetCodeRow {
  id: string;
  user_id: string;
  code_hash: string;
  attempts: number;
  expires_at: Date | string;
  used_at: Date | string | null;
  created_at: Date | string;
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly pool: Pool) {}

  public async createSession(session: SessionRecord): Promise<void> {
    await this.pool.query(
      `insert into sessions (id, user_id, token_hash, user_agent, ip_address, expires_at, revoked_at, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        session.id,
        session.userId,
        session.tokenHash,
        session.userAgent,
        session.ipAddress,
        session.expiresAt.toISOString(),
        session.revokedAt ? session.revokedAt.toISOString() : null,
        session.createdAt.toISOString(),
      ]
    );
  }

  public async findActiveSessionByTokenHash(
    tokenHash: string
  ): Promise<SessionRecord | null> {
    const result = await this.pool.query<SessionRow>(
      `select id, user_id, token_hash, user_agent, ip_address, expires_at, revoked_at, created_at
       from sessions
       where token_hash = $1
         and revoked_at is null
         and expires_at > now()
       limit 1`,
      [tokenHash]
    );

    const row = result.rows[0];
    return row ? this.mapSessionRow(row) : null;
  }

  public async revokeSessionById(sessionId: string): Promise<void> {
    await this.pool.query(
      `update sessions
       set revoked_at = now()
       where id = $1 and revoked_at is null`,
      [sessionId]
    );
  }

  public async revokeAllUserSessions(userId: string): Promise<void> {
    await this.pool.query(
      `update sessions
       set revoked_at = now()
       where user_id = $1 and revoked_at is null`,
      [userId]
    );
  }

  public async invalidateActiveResetCodes(userId: string): Promise<void> {
    await this.pool.query(
      `update password_reset_codes
       set used_at = now()
       where user_id = $1 and used_at is null`,
      [userId]
    );
  }

  public async createResetCode(record: PasswordResetCodeRecord): Promise<void> {
    await this.pool.query(
      `insert into password_reset_codes (id, user_id, code_hash, attempts, expires_at, used_at, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        record.id,
        record.userId,
        record.codeHash,
        record.attempts,
        record.expiresAt.toISOString(),
        record.usedAt ? record.usedAt.toISOString() : null,
        record.createdAt.toISOString(),
      ]
    );
  }

  public async findLatestActiveResetCode(
    userId: string
  ): Promise<PasswordResetCodeRecord | null> {
    const result = await this.pool.query<ResetCodeRow>(
      `select id, user_id, code_hash, attempts, expires_at, used_at, created_at
       from password_reset_codes
       where user_id = $1
         and used_at is null
         and expires_at > now()
       order by created_at desc
       limit 1`,
      [userId]
    );

    const row = result.rows[0];
    return row ? this.mapResetCodeRow(row) : null;
  }

  public async incrementResetCodeAttempts(codeId: string): Promise<number> {
    const result = await this.pool.query<{ attempts: number }>(
      `update password_reset_codes
       set attempts = attempts + 1
       where id = $1
       returning attempts`,
      [codeId]
    );

    return Number(result.rows[0]?.attempts ?? 0);
  }

  public async markResetCodeUsed(codeId: string): Promise<void> {
    await this.pool.query(
      `update password_reset_codes
       set used_at = now()
       where id = $1 and used_at is null`,
      [codeId]
    );
  }

  private mapSessionRow(row: SessionRow): SessionRecord {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      expiresAt: new Date(row.expires_at),
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
      createdAt: new Date(row.created_at),
    };
  }

  private mapResetCodeRow(row: ResetCodeRow): PasswordResetCodeRecord {
    return {
      id: row.id,
      userId: row.user_id,
      codeHash: row.code_hash,
      attempts: Number(row.attempts),
      expiresAt: new Date(row.expires_at),
      usedAt: row.used_at ? new Date(row.used_at) : null,
      createdAt: new Date(row.created_at),
    };
  }
}
