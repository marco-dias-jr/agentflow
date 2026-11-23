import { defineConfig } from "drizzle-kit";
import { loadRootEnv } from "./src/infrastructure/config/loadEnv";

loadRootEnv();

export default defineConfig({
  schema: "./src/infrastructure/database/drizzle/schema.ts",
  out: "./src/infrastructure/database/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
