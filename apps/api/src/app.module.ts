import { Inject, Module, OnModuleInit } from "@nestjs/common";
import { Pool } from "pg";
import { EmailSender } from "./application/ports/EmailSender";
import { LLMProvider } from "./application/ports/LLMProvider";
import { ToolExecutor } from "./application/ports/ToolExecutor";
import { LoginUser } from "./application/use-cases/auth/LoginUser";
import { RegisterUser } from "./application/use-cases/auth/RegisterUser";
import { RequestPasswordReset } from "./application/use-cases/auth/RequestPasswordReset";
import { ResetPassword } from "./application/use-cases/auth/ResetPassword";
import { CreateAgent } from "./application/use-cases/CreateAgent";
import { DeleteAgent } from "./application/use-cases/DeleteAgent";
import { ExecuteAgent } from "./application/use-cases/ExecuteAgent";
import { GetExecutionHistory } from "./application/use-cases/GetExecutionHistory";
import { UpdateAgent } from "./application/use-cases/UpdateAgent";
import { AgentRepository } from "./domain/repositories/AgentRepository";
import { AuthRepository } from "./domain/repositories/AuthRepository";
import { ExecutionRepository } from "./domain/repositories/ExecutionRepository";
import { UserRepository } from "./domain/repositories/UserRepository";
import { PostgresAgentRepository } from "./infrastructure/database/PostgresAgentRepository";
import { PostgresAuthRepository } from "./infrastructure/database/PostgresAuthRepository";
import { PostgresExecutionRepository } from "./infrastructure/database/PostgresExecutionRepository";
import {
  createPostgresPool,
  ensureDatabaseSchema,
} from "./infrastructure/database/PostgresPool";
import { PostgresUserRepository } from "./infrastructure/database/PostgresUserRepository";
import { ResendOrConsoleEmailSender } from "./infrastructure/email/ResendOrConsoleEmailSender";
import { createLLMProviderRouter } from "./infrastructure/llm/LLMProviderRouter";
import { PasswordHasher } from "./infrastructure/security/PasswordHasher";
import { TokenSecurity } from "./infrastructure/security/TokenSecurity";
import { ToolRegistryExecutor } from "./infrastructure/tools/ToolRegistryExecutor";
import {
  AGENT_REPOSITORY_TOKEN,
  AgentsController,
  CREATE_AGENT_USE_CASE_TOKEN,
  DELETE_AGENT_USE_CASE_TOKEN,
  UPDATE_AGENT_USE_CASE_TOKEN,
} from "./presentation/controllers/AgentsController";
import {
  AuthController,
  LOGIN_USER_USE_CASE_TOKEN,
  REGISTER_USER_USE_CASE_TOKEN,
  REQUEST_RESET_USE_CASE_TOKEN,
  RESET_PASSWORD_USE_CASE_TOKEN,
} from "./presentation/controllers/AuthController";
import {
  EXECUTE_AGENT_USE_CASE_TOKEN,
  ExecutionsController,
  GET_EXECUTION_HISTORY_USE_CASE_TOKEN,
} from "./presentation/controllers/ExecutionsController";
import { ModelsController } from "./presentation/controllers/ModelsController";
import {
  AUTH_REPOSITORY_TOKEN,
  AuthGuard,
  TOKEN_SECURITY_TOKEN,
  USER_REPOSITORY_TOKEN,
} from "./presentation/security/AuthGuard";

const PG_POOL_TOKEN = Symbol("PG_POOL_TOKEN");
const EXECUTION_REPOSITORY_TOKEN = Symbol("EXECUTION_REPOSITORY_TOKEN");
const LLM_PROVIDER_TOKEN = Symbol("LLM_PROVIDER_TOKEN");
const TOOL_EXECUTOR_TOKEN = Symbol("TOOL_EXECUTOR_TOKEN");
const PASSWORD_HASHER_TOKEN = Symbol("PASSWORD_HASHER_TOKEN");
const EMAIL_SENDER_TOKEN = Symbol("EMAIL_SENDER_TOKEN");

@Module({
  controllers: [
    AuthController,
    AgentsController,
    ExecutionsController,
    ModelsController,
  ],
  providers: [
    AuthGuard,
    {
      provide: PG_POOL_TOKEN,
      useFactory: () => createPostgresPool(),
    },
    {
      provide: USER_REPOSITORY_TOKEN,
      useFactory: (pool: Pool) => new PostgresUserRepository(pool),
      inject: [PG_POOL_TOKEN],
    },
    {
      provide: AUTH_REPOSITORY_TOKEN,
      useFactory: (pool: Pool) => new PostgresAuthRepository(pool),
      inject: [PG_POOL_TOKEN],
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
      provide: PASSWORD_HASHER_TOKEN,
      useFactory: () => new PasswordHasher(),
    },
    {
      provide: TOKEN_SECURITY_TOKEN,
      useFactory: () => new TokenSecurity(),
    },
    {
      provide: EMAIL_SENDER_TOKEN,
      useFactory: () => new ResendOrConsoleEmailSender(),
    },
    {
      provide: REGISTER_USER_USE_CASE_TOKEN,
      useFactory: (userRepo: UserRepository, hasher: PasswordHasher) =>
        new RegisterUser(userRepo, hasher),
      inject: [USER_REPOSITORY_TOKEN, PASSWORD_HASHER_TOKEN],
    },
    {
      provide: LOGIN_USER_USE_CASE_TOKEN,
      useFactory: (
        userRepo: UserRepository,
        authRepo: AuthRepository,
        hasher: PasswordHasher,
        tokenSecurity: TokenSecurity
      ) => new LoginUser(userRepo, authRepo, hasher, tokenSecurity),
      inject: [
        USER_REPOSITORY_TOKEN,
        AUTH_REPOSITORY_TOKEN,
        PASSWORD_HASHER_TOKEN,
        TOKEN_SECURITY_TOKEN,
      ],
    },
    {
      provide: REQUEST_RESET_USE_CASE_TOKEN,
      useFactory: (
        userRepo: UserRepository,
        authRepo: AuthRepository,
        tokenSecurity: TokenSecurity,
        emailSender: EmailSender
      ) =>
        new RequestPasswordReset(
          userRepo,
          authRepo,
          tokenSecurity,
          emailSender
        ),
      inject: [
        USER_REPOSITORY_TOKEN,
        AUTH_REPOSITORY_TOKEN,
        TOKEN_SECURITY_TOKEN,
        EMAIL_SENDER_TOKEN,
      ],
    },
    {
      provide: RESET_PASSWORD_USE_CASE_TOKEN,
      useFactory: (
        userRepo: UserRepository,
        authRepo: AuthRepository,
        hasher: PasswordHasher,
        tokenSecurity: TokenSecurity
      ) => new ResetPassword(userRepo, authRepo, hasher, tokenSecurity),
      inject: [
        USER_REPOSITORY_TOKEN,
        AUTH_REPOSITORY_TOKEN,
        PASSWORD_HASHER_TOKEN,
        TOKEN_SECURITY_TOKEN,
      ],
    },
    {
      provide: LLM_PROVIDER_TOKEN,
      useFactory: () => createLLMProviderRouter(process.env),
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
      provide: UPDATE_AGENT_USE_CASE_TOKEN,
      useFactory: (agentRepo: AgentRepository) => new UpdateAgent(agentRepo),
      inject: [AGENT_REPOSITORY_TOKEN],
    },
    {
      provide: DELETE_AGENT_USE_CASE_TOKEN,
      useFactory: (agentRepo: AgentRepository) => new DeleteAgent(agentRepo),
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
export class AppModule implements OnModuleInit {
  constructor(@Inject(PG_POOL_TOKEN) private readonly pool: Pool) {}

  public async onModuleInit(): Promise<void> {
    await ensureDatabaseSchema(this.pool);
  }
}
