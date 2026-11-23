import crypto from "node:crypto";
import { User } from "../../../domain/entities/User";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { Cpf } from "../../../domain/value-objects/Cpf";
import { PasswordHasher } from "../../../infrastructure/security/PasswordHasher";

export interface RegisterUserCommand {
  fullName: string;
  email: string;
  cpf: string;
  password: string;
}

export class RegisterUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher
  ) {}

  public async execute(command: RegisterUserCommand): Promise<User> {
    const normalizedEmail = command.email.trim().toLowerCase();
    const validCpf = Cpf.create(command.cpf);

    const existingEmail = await this.userRepository.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new Error("Unable to complete registration with provided credentials.");
    }

    const existingCpf = await this.userRepository.findByCpf(validCpf.value);
    if (existingCpf) {
      throw new Error("Unable to complete registration with provided credentials.");
    }

    const passwordHash = await this.passwordHasher.hash(command.password);
    const user = User.create({
      id: crypto.randomUUID(),
      fullName: command.fullName,
      email: normalizedEmail,
      cpf: validCpf.value,
      passwordHash,
    });

    await this.userRepository.save(user);
    return user;
  }
}
