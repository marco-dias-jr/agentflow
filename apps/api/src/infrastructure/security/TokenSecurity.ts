import crypto from "node:crypto";

export class TokenSecurity {
  private readonly secret: string;

  constructor(secret?: string) {
    this.secret = (
      secret ??
      process.env.SESSION_SECRET ??
      "dev-insecure-session-secret-change-in-prod"
    ).trim();
  }

  public generateSessionToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = this.hashSessionToken(rawToken);
    return { rawToken, tokenHash };
  }

  public hashSessionToken(rawToken: string): string {
    return crypto
      .createHmac("sha256", this.secret)
      .update(rawToken)
      .digest("hex");
  }

  public generateResetCode(): { code: string; codeHash: string } {
    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = this.hashResetCode(code);
    return { code, codeHash };
  }

  public hashResetCode(code: string): string {
    return crypto
      .createHmac("sha256", `${this.secret}:reset`)
      .update(code.trim())
      .digest("hex");
  }

  public constantTimeEqualHex(a: string, b: string): boolean {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length === 0 || bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
