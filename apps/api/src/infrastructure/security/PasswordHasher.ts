import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export class PasswordHasher {
  private readonly pepper: string;

  constructor(pepper?: string) {
    this.pepper = (pepper ?? process.env.PASSWORD_PEPPER ?? "").trim();
  }

  public validateStrength(plainPassword: string): void {
    if (plainPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }
    if (plainPassword.length > 128) {
      throw new Error("Password must be at most 128 characters long.");
    }
    if (!/[A-Za-z]/.test(plainPassword) || !/\d/.test(plainPassword)) {
      throw new Error("Password must include at least one letter and one number.");
    }
  }

  public async hash(plainPassword: string): Promise<string> {
    this.validateStrength(plainPassword);
    const salt = crypto.randomBytes(16).toString("hex");
    const derived = (await scryptAsync(
      `${plainPassword}${this.pepper}`,
      salt,
      KEY_LENGTH
    )) as Buffer;

    return `${salt}:${derived.toString("hex")}`;
  }

  public async verify(plainPassword: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split(":");
    if (parts.length !== 2) {
      return false;
    }

    const [salt, keyHex] = parts;
    const expectedBuffer = Buffer.from(keyHex, "hex");
    if (expectedBuffer.length !== KEY_LENGTH) {
      return false;
    }

    const derived = (await scryptAsync(
      `${plainPassword}${this.pepper}`,
      salt,
      KEY_LENGTH
    )) as Buffer;

    return crypto.timingSafeEqual(expectedBuffer, derived);
  }
}
