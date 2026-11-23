import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { CreateAgent } from "../../application/use-cases/CreateAgent";
import { AgentRepository } from "../../domain/repositories/AgentRepository";
import { createAgentSchema } from "../dto/CreateAgentDto";

export const AGENT_REPOSITORY_TOKEN = Symbol("AGENT_REPOSITORY_TOKEN");
export const CREATE_AGENT_USE_CASE_TOKEN = Symbol("CREATE_AGENT_USE_CASE_TOKEN");

@Controller("agents")
export class AgentsController {
  constructor(
    @Inject(CREATE_AGENT_USE_CASE_TOKEN)
    private readonly createAgentUseCase: CreateAgent,
    @Inject(AGENT_REPOSITORY_TOKEN)
    private readonly agentRepository: AgentRepository
  ) {}

  @Post()
  public async create(@Body() body: unknown) {
    const parsed = createAgentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid agent payload",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const agent = await this.createAgentUseCase.execute(parsed.data);
      return { data: agent };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create agent";
      throw new BadRequestException(message);
    }
  }

  @Get()
  public async list() {
    const agents = await this.agentRepository.findAll();
    return { data: agents };
  }

  @Get(":id")
  public async getById(@Param("id") id: string) {
    const agent = await this.agentRepository.findById(id);
    if (!agent) {
      throw new NotFoundException(`Agent not found: ${id}`);
    }
    return { data: agent };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async remove(@Param("id") id: string) {
    const existing = await this.agentRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Agent not found: ${id}`);
    }
    await this.agentRepository.deleteById(id);
  }
}
