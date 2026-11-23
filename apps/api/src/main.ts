import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { loadRootEnv } from "./infrastructure/config/loadEnv";

async function bootstrap(): Promise<void> {
  loadRootEnv();

  const app = await NestFactory.create(AppModule);

  // Security hardening headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );
    next();
  });

  const allowedOrigin = process.env.CORS_ORIGIN?.trim() || "http://localhost:3000";
  app.enableCors({
    origin: allowedOrigin,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`AgentFlow API running on http://localhost:${port}`);
}

void bootstrap();
