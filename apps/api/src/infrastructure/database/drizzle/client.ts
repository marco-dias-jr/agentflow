import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DrizzleDatabase = NodePgDatabase<typeof schema>;

export function createDrizzleClient(pool: Pool): DrizzleDatabase {
  return drizzle(pool, { schema });
}
