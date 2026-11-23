import { AuthRepository } from "../../../domain/repositories/AuthRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { PasswordHasher } from "../../../infrastructure/security/PasswordHasher";
import { TokenSecurity } from "../../../infrastructure/security/TokenSecurity";

export interface ResetPasswordCommand {
  email: string;
  code: string;
  newPassword: string;
}

const MAX_RESET_ATTEMPTS = 5;

export class ResetPassword {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenSecurity: TokenSecurity
  ) {}

  public async execute(command: ResetPasswordCommand): Promise<void> {
    const normalizedEmail = command.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new Error("Invalid or expired verification code.");
    }

    const activeCode = await this.authRepository.findLatestActiveResetCode(
      user.id
    );
    if (!activeCode) {
      throw new Error("Invalid or expired verification code.");
    }

    const submittedHash = this.tokenSecurity.hashResetCode(command.code);
    const isMatch = this.tokenSecurity.constantTimeEqualHex(
      activeCode.codeHash,
      submittedHash
    );

    if (!isMatch) {
      const attempts = await this.authRepository.incrementResetCodeAttempts(
        activeCode.id
      );
      if (attempts >= MAX_RESET_ATTEMPTS) {
        await this.authRepository.markResetCodeUsed(activeCode.id);
      }
      throw new Error("Invalid or expired verification code.");
    }

    const newPasswordHash = await this.passwordHasher.hash(command.newPassword);
    user.changePassword(newPasswordHash);

    await this.userRepository.save(user);
    await this.authRepository.markResetCodeUsed(activeCode.id);
    await this.authRepository.revokeAllUserSessions(user.id);
  }
}
