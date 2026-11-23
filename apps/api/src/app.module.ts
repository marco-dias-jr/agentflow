import { Module } from "@nestjs/common";
import { Pool } from "pg";
import { LLMProvider } from "./application/ports/LLMProvider";
import { ToolExecutor } from "./application/ports/ToolExecutor";
import { CreateAgent } from "./application/use-cases/CreateAgent";
import { ExecuteAgent } from "./application/use-cases/ExecuteAgent";
import { GetExecutionHistory } from "./application/use-cases/GetExecutionHistory";
import { AgentRepository } from "./domain/repositories/AgentRepository";
import { ExecutionRepository } from "./domain/repositories/ExecutionRepository";
import { PostgresAgentRepository } from "./infrastructure/database/PostgresAgentRepository";
import { PostgresExecutionRepository } from "./infrastructure/database/PostgresExecutionRepository";
import { createPostgresPool } from "./infrastructure/database/PostgresPool";
import { createLLMProvider } from "./infrastructure/llm/createLLMProvider";
import { ToolRegistryExecutor } from "./infrastructure/tools/ToolRegistryExecutor";
import {
  AGENT_REPOSITORY_TOKEN,
  AgentsController,
  CREATE_AGENT_USE_CASE_TOKEN,
} from "./presentation/controllers/AgentsController";
import {
  EXECUTE_AGENT_USE_CASE_TOKEN,
  ExecutionsController,
  GET_EXECUTION_HISTORY_USE_CASE_TOKEN,
} from "./presentation/controllers/ExecutionsController";

const PG_POOL_TOKEN = Symbol("PG_POOL_TOKEN");
const EXECUTION_REPOSITORY_TOKEN = Symbol("EXECUTION_REPOSITORY_TOKEN");
const LLM_PROVIDER_TOKEN = Symbol("LLM_PROVIDER_TOKEN");
const TOOL_EXECUTOR_TOKEN = Symbol("TOOL_EXECUTOR_TOKEN");

@Module({
  controllers: [AgentsController, ExecutionsController],
  providers: [
    {
      provide: PG_POOL_TOKEN,
      useFactory: () => createPostgresPool(),
    },
    {
      provide: AGENT_REPOSITORY_TOKEN,
      useFactory: (pool: Pool) => new PostgresAgentRepository(pool),
      inject: [PG_POOL_TOKEN],
    },
    {
      provide: EXECUTION_REPOSITORY_TOKEN,
      useFactory: (pool: Pool) => new PostgresExecutionRepository(pool),
      inject: [PG_POOL_TOKEN],
    },
    {
      provide: LLM_PROVIDER_TOKEN,
      useFactory: () => createLLMProvider(process.env),
    },
    {
      provide: TOOL_EXECUTOR_TOKEN,
      useFactory: () => new ToolRegistryExecutor(),
    },
    {
      provide: CREATE_AGENT_USE_CASE_TOKEN,
      useFactory: (agentRepo: AgentRepository) => new CreateAgent(agentRepo),
      inject: [AGENT_REPOSITORY_TOKEN],
    },
    {
      provide: EXECUTE_AGENT_USE_CASE_TOKEN,
      useFactory: (
        agentRepo: AgentRepository,
        executionRepo: ExecutionRepository,
        llmProvider: LLMProvider,
        toolExecutor: ToolExecutor
      ) => new ExecuteAgent(agentRepo, executionRepo, llmProvider, toolExecutor),
      inject: [
        AGENT_REPOSITORY_TOKEN,
        EXECUTION_REPOSITORY_TOKEN,
        LLM_PROVIDER_TOKEN,
        TOOL_EXECUTOR_TOKEN,
      ],
    },
    {
      provide: GET_EXECUTION_HISTORY_USE_CASE_TOKEN,
      useFactory: (executionRepo: ExecutionRepository) =>
        new GetExecutionHistory(executionRepo),
      inject: [EXECUTION_REPOSITORY_TOKEN],
    },
  ],
})
export class AppModule {}
