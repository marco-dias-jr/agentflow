import { Cpf } from "../value-objects/Cpf";

export interface UserProps {
  id: string;
  fullName: string;
  email: string;
  cpf: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  id: string;
  fullName: string;
  email: string;
  cpf: string;
  passwordHash: string;
  now?: Date;
}

export class User {
  public readonly id: string;
  public fullName: string;
  public email: string;
  public cpf: string;
  public passwordHash: string;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.fullName = props.fullName;
    this.email = props.email;
    this.cpf = props.cpf;
    this.passwordHash = props.passwordHash;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(input: CreateUserInput): User {
    const normalizedName = input.fullName.trim().replace(/\s+/g, " ");
    if (normalizedName.length < 3) {
      throw new Error("Full name must have at least 3 characters.");
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error("Valid email address is required.");
    }

    const validCpf = Cpf.create(input.cpf);

    if (!input.passwordHash || !input.passwordHash.trim()) {
      throw new Error("Password hash is required.");
    }

    const timestamp = input.now ?? new Date();
    return new User({
      id: input.id,
      fullName: normalizedName,
      email: normalizedEmail,
      cpf: validCpf.value,
      passwordHash: input.passwordHash,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  public changePassword(newPasswordHash: string, now?: Date): void {
    if (!newPasswordHash || !newPasswordHash.trim()) {
      throw new Error("Password hash is required.");
    }
    this.passwordHash = newPasswordHash;
    this.updatedAt = now ?? new Date();
  }
}
