import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { ExecuteAgent } from "../../application/use-cases/ExecuteAgent";
import { GetExecutionHistory } from "../../application/use-cases/GetExecutionHistory";
import { AgentRepository } from "../../domain/repositories/AgentRepository";
import { executeAgentSchema } from "../dto/ExecuteAgentDto";
import { AGENT_REPOSITORY_TOKEN } from "./AgentsController";

export const EXECUTE_AGENT_USE_CASE_TOKEN = Symbol("EXECUTE_AGENT_USE_CASE_TOKEN");
export const GET_EXECUTION_HISTORY_USE_CASE_TOKEN = Symbol(
  "GET_EXECUTION_HISTORY_USE_CASE_TOKEN"
);

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(clientKey: string): void {
  const now = Date.now();
  const current = rateLimitStore.get(clientKey);

  if (!current || now > current.resetAt) {
    rateLimitStore.set(clientKey, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new HttpException(
      "Too many execution requests. Please wait a minute and try again.",
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  current.count += 1;
}

@Controller("agents/:agentId")
export class ExecutionsController {
  constructor(
    @Inject(AGENT_REPOSITORY_TOKEN)
    private readonly agentRepository: AgentRepository,
    @Inject(EXECUTE_AGENT_USE_CASE_TOKEN)
    private readonly executeAgentUseCase: ExecuteAgent,
    @Inject(GET_EXECUTION_HISTORY_USE_CASE_TOKEN)
    private readonly getExecutionHistoryUseCase: GetExecutionHistory
  ) {}

  @Post("executions")
  public async execute(
    @Param("agentId") agentId: string,
    @Body() body: unknown,
    @Req() req: Request
  ) {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    checkRateLimit(clientIp);

    const parsed = executeAgentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid execution payload",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const agent = await this.agentRepository.findById(agentId);
    if (!agent) {
      throw new NotFoundException(`Agent not found: ${agentId}`);
    }

    const execution = await this.executeAgentUseCase.execute({
      agentId,
      prompt: parsed.data.prompt,
      maxToolIterations: parsed.data.maxToolIterations,
    });

    return { data: execution };
  }

  @Get("executions")
  public async history(@Param("agentId") agentId: string) {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) {
      throw new NotFoundException(`Agent not found: ${agentId}`);
    }

    const executions = await this.getExecutionHistoryUseCase.execute(agentId);
    return { data: executions };
  }
}
