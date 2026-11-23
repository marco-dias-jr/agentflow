import { Request, Response } from "express";

export const SESSION_COOKIE_NAME = "agentflow_session";

export function extractSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawVal] = part.trim().split("=");
    if (rawKey === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rawVal.join("="));
    }
  }
  return null;
}

export function setSessionCookie(
  res: Response,
  rawToken: string,
  expiresAt: Date
): void {
  const isProd = process.env.NODE_ENV === "production";
  const sameSite = isProd ? "None" : "Lax";
  const secureFlag = isProd ? "; Secure" : "";

  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=${sameSite}${secureFlag}; Expires=${expiresAt.toUTCString()}`
  );
}

export function clearSessionCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === "production";
  const sameSite = isProd ? "None" : "Lax";
  const secureFlag = isProd ? "; Secure" : "";

  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=${sameSite}${secureFlag}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
}
