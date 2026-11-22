import { Pool } from "pg";

export function createPostgresPool(databaseUrl?: string): Pool {
  const connectionString = (databaseUrl ?? process.env.DATABASE_URL ?? "").trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize PostgreSQL pool.");
  }

  const requiresSsl =
    connectionString.includes("sslmode=require") ||
    connectionString.includes("neon.tech") ||
    connectionString.includes("supabase.co");

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  });
}
