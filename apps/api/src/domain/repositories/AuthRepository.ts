export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface PasswordResetCodeRecord {
  id: string;
  userId: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface AuthRepository {
  createSession(session: SessionRecord): Promise<void>;
  findActiveSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeSessionById(sessionId: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;

  invalidateActiveResetCodes(userId: string): Promise<void>;
  createResetCode(record: PasswordResetCodeRecord): Promise<void>;
  findLatestActiveResetCode(userId: string): Promise<PasswordResetCodeRecord | null>;
  incrementResetCodeAttempts(codeId: string): Promise<number>;
  markResetCodeUsed(codeId: string): Promise<void>;
}
