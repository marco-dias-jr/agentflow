import fs from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { loadRootEnv } from "../../config/loadEnv";
import { createPostgresPool } from "../PostgresPool";
import { createDrizzleClient } from "./client";

function resolveMigrationsFolder(): string {
  const candidates = [
    path.resolve(__dirname, "migrations"),
    path.resolve(
      process.cwd(),
      "src/infrastructure/database/drizzle/migrations"
    ),
    path.resolve(
      process.cwd(),
      "apps/api/src/infrastructure/database/drizzle/migrations"
    ),
  ];

  const found = candidates.find((dir) => fs.existsSync(dir));
  if (!found) {
    throw new Error(
      `Drizzle migrations folder not found. Checked: ${candidates.join(", ")}`
    );
  }
  return found;
}

export async function runDatabaseMigrations(pool: Pool): Promise<void> {
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
  } catch {
    console.warn(
      "[DB] pgvector extension not available in this database environment; continuing."
    );
  }

  const db = createDrizzleClient(pool);
  const migrationsFolder = resolveMigrationsFolder();
  await migrate(db, { migrationsFolder });
}

// Allow running directly via CLI: npm --prefix apps/api run db:migrate
if (require.main === module) {
  loadRootEnv();
  const pool = createPostgresPool();
  runDatabaseMigrations(pool)
    .then(async () => {
      console.log("[DB] Drizzle migrations applied successfully.");
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("[DB] Migration failed:", error);
      await pool.end();
      process.exit(1);
    });
}
