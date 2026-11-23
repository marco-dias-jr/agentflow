import { Pool } from "pg";

function normalizeConnectionString(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const sslMode = parsed.searchParams.get("sslmode");

    if (sslMode === "require" || sslMode === "prefer" || sslMode === "verify-ca") {
      parsed.searchParams.set("sslmode", "verify-full");
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function createPostgresPool(connectionString?: string): Pool {
  const rawUrl = connectionString ?? process.env.DATABASE_URL;

  if (!rawUrl || !rawUrl.trim()) {
    throw new Error("DATABASE_URL is required to initialize PostgreSQL pool.");
  }

  const normalizedUrl = normalizeConnectionString(rawUrl.trim());

  return new Pool({
    connectionString: normalizedUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}
