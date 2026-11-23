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
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { CreateAgent } from "../../application/use-cases/CreateAgent";
import { DeleteAgent } from "../../application/use-cases/DeleteAgent";
import { UpdateAgent } from "../../application/use-cases/UpdateAgent";
import { AgentRepository } from "../../domain/repositories/AgentRepository";
import { createAgentSchema } from "../dto/CreateAgentDto";
import { updateAgentSchema } from "../dto/UpdateAgentDto";
import { AuthenticatedRequest, AuthGuard } from "../security/AuthGuard";

export const AGENT_REPOSITORY_TOKEN = Symbol("AGENT_REPOSITORY_TOKEN");
export const CREATE_AGENT_USE_CASE_TOKEN = Symbol("CREATE_AGENT_USE_CASE_TOKEN");
export const UPDATE_AGENT_USE_CASE_TOKEN = Symbol("UPDATE_AGENT_USE_CASE_TOKEN");
export const DELETE_AGENT_USE_CASE_TOKEN = Symbol("DELETE_AGENT_USE_CASE_TOKEN");

@Controller("agents")
@UseGuards(AuthGuard)
export class AgentsController {
  constructor(
    @Inject(CREATE_AGENT_USE_CASE_TOKEN)
    private readonly createAgentUseCase: CreateAgent,
    @Inject(UPDATE_AGENT_USE_CASE_TOKEN)
    private readonly updateAgentUseCase: UpdateAgent,
    @Inject(DELETE_AGENT_USE_CASE_TOKEN)
    private readonly deleteAgentUseCase: DeleteAgent,
    @Inject(AGENT_REPOSITORY_TOKEN)
    private readonly agentRepository: AgentRepository
  ) {}

  @Post()
  public async create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const parsed = createAgentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid agent payload",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = req.user!.id;

    try {
      const agent = await this.createAgentUseCase.execute({
        ...parsed.data,
        userId,
      });
      console.log(
        `[API] Created agent ${agent.id} (${agent.name}, model=${agent.model}, user=${userId})`
      );
      return { data: agent };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create agent";
      throw new BadRequestException(message);
    }
  }

  @Patch(":id")
  public async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest
  ) {
    const parsed = updateAgentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid agent update payload",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = req.user!.id;

    try {
      const agent = await this.updateAgentUseCase.execute({
        id,
        userId,
        ...parsed.data,
      });
      console.log(
        `[API] Updated agent ${agent.id} (model=${agent.model}, tools=${agent.enabledTools.join(",") || "none"})`
      );
      return { data: agent };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update agent";
      if (message.startsWith("Agent not found:")) {
        throw new NotFoundException(message);
      }
      throw new BadRequestException(message);
    }
  }

  @Get()
  public async list(@Req() req: AuthenticatedRequest) {
    const agents = await this.agentRepository.findAllByUserId(req.user!.id);
    return { data: agents };
  }

  @Get(":id")
  public async getById(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest
  ) {
    const agent = await this.agentRepository.findByIdForUser(id, req.user!.id);
    if (!agent) {
      throw new NotFoundException(`Agent not found: ${id}`);
    }
    return { data: agent };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async remove(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest
  ) {
    try {
      await this.deleteAgentUseCase.execute(id, req.user!.id);
      console.log(`[API] Deleted agent ${id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete agent";
      if (message.startsWith("Agent not found:")) {
        throw new NotFoundException(message);
      }
      throw new BadRequestException(message);
    }
  }
}
