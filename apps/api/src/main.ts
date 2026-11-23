import "reflect-metadata";
import { resolve } from "path";
import { config as loadEnv } from "dotenv";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// Load root .env when running locally from apps/api or monorepo root
loadEnv({ path: resolve(__dirname, "../../../.env") });
loadEnv();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`AgentFlow API running on http://localhost:${port}`);
}

void bootstrap();
