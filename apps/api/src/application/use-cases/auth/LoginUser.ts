import crypto from "node:crypto";
import { User } from "../../../domain/entities/User";
import { AuthRepository } from "../../../domain/repositories/AuthRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { PasswordHasher } from "../../../infrastructure/security/PasswordHasher";
import { TokenSecurity } from "../../../infrastructure/security/TokenSecurity";

export interface LoginUserCommand {
  email: string;
  password: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface LoginUserResult {
  user: User;
  rawSessionToken: string;
  expiresAt: Date;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class LoginUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenSecurity: TokenSecurity
  ) {}

  public async execute(command: LoginUserCommand): Promise<LoginUserResult> {
    const normalizedEmail = command.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    // Dummy hash check mitigates timing-based user enumeration
    const fallbackHash =
      "00000000000000000000000000000000:000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    const passwordMatches = await this.passwordHasher.verify(
      command.password,
      user ? user.passwordHash : fallbackHash
    );

    if (!user || !passwordMatches) {
      throw new Error("Invalid email or password.");
    }

    const { rawToken, tokenHash } = this.tokenSecurity.generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    await this.authRepository.createSession({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash,
      userAgent: command.userAgent ?? null,
      ipAddress: command.ipAddress ?? null,
      expiresAt,
      revokedAt: null,
      createdAt: now,
    });

    return {
      user,
      rawSessionToken: rawToken,
      expiresAt,
    };
  }
}
