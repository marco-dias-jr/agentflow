import { describe, expect, it } from "vitest";
import { LoginUser } from "../../apps/api/src/application/use-cases/auth/LoginUser";
import { RegisterUser } from "../../apps/api/src/application/use-cases/auth/RegisterUser";
import { RequestPasswordReset } from "../../apps/api/src/application/use-cases/auth/RequestPasswordReset";
import { ResetPassword } from "../../apps/api/src/application/use-cases/auth/ResetPassword";
import { User } from "../../apps/api/src/domain/entities/User";
import {
  AuthRepository,
  PasswordResetCodeRecord,
  SessionRecord,
} from "../../apps/api/src/domain/repositories/AuthRepository";
import { UserRepository } from "../../apps/api/src/domain/repositories/UserRepository";
import { Cpf } from "../../apps/api/src/domain/value-objects/Cpf";
import { PasswordHasher } from "../../apps/api/src/infrastructure/security/PasswordHasher";
import { TokenSecurity } from "../../apps/api/src/infrastructure/security/TokenSecurity";

class InMemoryUserRepo implements UserRepository {
  public users = new Map<string, User>();

  public async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }
  public async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }
  public async findByEmail(email: string): Promise<User | null> {
    return (
      Array.from(this.users.values()).find((u) => u.email === email) ?? null
    );
  }
  public async findByCpf(cpf: string): Promise<User | null> {
    return Array.from(this.users.values()).find((u) => u.cpf === cpf) ?? null;
  }
}

class InMemoryAuthRepo implements AuthRepository {
  public sessions: SessionRecord[] = [];
  public codes: PasswordResetCodeRecord[] = [];

  public async createSession(session: SessionRecord): Promise<void> {
    this.sessions.push(session);
  }
  public async findActiveSessionByTokenHash(
    tokenHash: string
  ): Promise<SessionRecord | null> {
    return (
      this.sessions.find(
        (s) => s.tokenHash === tokenHash && !s.revokedAt && s.expiresAt > new Date()
      ) ?? null
    );
  }
  public async revokeSessionById(sessionId: string): Promise<void> {
    const s = this.sessions.find((item) => item.id === sessionId);
    if (s) s.revokedAt = new Date();
  }
  public async revokeAllUserSessions(userId: string): Promise<void> {
    for (const s of this.sessions) {
      if (s.userId === userId && !s.revokedAt) s.revokedAt = new Date();
    }
  }
  public async invalidateActiveResetCodes(userId: string): Promise<void> {
    for (const c of this.codes) {
      if (c.userId === userId && !c.usedAt) c.usedAt = new Date();
    }
  }
  public async createResetCode(record: PasswordResetCodeRecord): Promise<void> {
    this.codes.push(record);
  }
  public async findLatestActiveResetCode(
    userId: string
  ): Promise<PasswordResetCodeRecord | null> {
    return (
      [...this.codes]
        .reverse()
        .find(
          (c) => c.userId === userId && !c.usedAt && c.expiresAt > new Date()
        ) ?? null
    );
  }
  public async incrementResetCodeAttempts(codeId: string): Promise<number> {
    const c = this.codes.find((item) => item.id === codeId);
    if (!c) return 0;
    c.attempts += 1;
    return c.attempts;
  }
  public async markResetCodeUsed(codeId: string): Promise<void> {
    const c = this.codes.find((item) => item.id === codeId);
    if (c) c.usedAt = new Date();
  }
}

describe("CPF and Auth security flow", () => {
  it("validates valid CPFs and rejects invalid or repeated digits", () => {
    expect(Cpf.isValid("529.982.247-25")).toBe(true);
    expect(Cpf.create("529.982.247-25").value).toBe("52998224725");
    expect(Cpf.isValid("111.111.111-11")).toBe(false);
    expect(Cpf.isValid("529.982.247-26")).toBe(false);
  });

  it("registers user with salted scrypt hash, logs in, and resets password revoking sessions", async () => {
    const userRepo = new InMemoryUserRepo();
    const authRepo = new InMemoryAuthRepo();
    const hasher = new PasswordHasher("test-pepper");
    const tokenSec = new TokenSecurity("test-secret");

    let sentCode = "";
    const emailSender = {
      async sendPasswordResetCode(input: { code: string }) {
        sentCode = input.code;
      },
    };

    const register = new RegisterUser(userRepo, hasher);
    const login = new LoginUser(userRepo, authRepo, hasher, tokenSec);
    const requestReset = new RequestPasswordReset(
      userRepo,
      authRepo,
      tokenSec,
      emailSender
    );
    const resetPassword = new ResetPassword(
      userRepo,
      authRepo,
      hasher,
      tokenSec
    );

    const user = await register.execute({
      fullName: "Marco Antonio Dias Junior",
      email: "marco@example.com",
      cpf: "529.982.247-25",
      password: "Password123",
    });

    expect(user.passwordHash).not.toContain("Password123");
    expect(user.passwordHash.split(":")).toHaveLength(2);

    const session = await login.execute({
      email: "marco@example.com",
      password: "Password123",
    });
    expect(session.rawSessionToken.length).toBeGreaterThan(20);

    await requestReset.execute("marco@example.com");
    expect(sentCode).toMatch(/^\d{6}$/);

    await resetPassword.execute({
      email: "marco@example.com",
      code: sentCode,
      newPassword: "NewPassword456",
    });

    // Previous session must be revoked after password reset
    const activeSession = await authRepo.findActiveSessionByTokenHash(
      tokenSec.hashSessionToken(session.rawSessionToken)
    );
    expect(activeSession).toBeNull();
  });
});
