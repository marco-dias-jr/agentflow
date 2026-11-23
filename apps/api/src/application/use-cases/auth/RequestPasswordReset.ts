import crypto from "node:crypto";
import { AuthRepository } from "../../../domain/repositories/AuthRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { EmailSender } from "../../ports/EmailSender";
import { TokenSecurity } from "../../../infrastructure/security/TokenSecurity";

const RESET_TTL_MINUTES = 10;

export class RequestPasswordReset {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
    private readonly tokenSecurity: TokenSecurity,
    private readonly emailSender: EmailSender
  ) {}

  public async execute(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      // Silent return prevents email enumeration
      return;
    }

    await this.authRepository.invalidateActiveResetCodes(user.id);

    const { code, codeHash } = this.tokenSecurity.generateResetCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_TTL_MINUTES * 60 * 1000);

    await this.authRepository.createResetCode({
      id: crypto.randomUUID(),
      userId: user.id,
      codeHash,
      attempts: 0,
      expiresAt,
      usedAt: null,
      createdAt: now,
    });

    await this.emailSender.sendPasswordResetCode({
      toEmail: user.email,
      fullName: user.fullName,
      code,
      expiresInMinutes: RESET_TTL_MINUTES,
    });
  }
}
