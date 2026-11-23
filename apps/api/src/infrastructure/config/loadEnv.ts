import { resolve } from "path";
import { config as loadEnv } from "dotenv";

export function loadRootEnv(): void {
  // Load monorepo root .env, then fallback to apps/api/.env and cwd .env
  loadEnv({ path: resolve(__dirname, "../../../../../.env") });
  loadEnv({ path: resolve(__dirname, "../../../.env") });
  loadEnv();
}
