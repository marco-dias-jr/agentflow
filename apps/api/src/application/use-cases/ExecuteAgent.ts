import { randomUUID } from "crypto";
import { Execution } from "../../domain/entities/Execution";
import { AgentRepository } from "../../domain/repositories/AgentRepository";
import { ExecutionRepository } from "../../domain/repositories/ExecutionRepository";
import { ChatMessage, LLMProvider } from "../ports/LLMProvider";
import { ToolExecutor } from "../ports/ToolExecutor";

export interface ExecuteAgentCommand {
  agentId: string;
  userId: string;
  prompt: string;
  maxToolIterations?: number;
}

export class ExecuteAgent {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly executionRepository: ExecutionRepository,
    private readonly llmProvider: LLMProvider,
    private readonly toolExecutor: ToolExecutor
  ) {}

  public async execute(command: ExecuteAgentCommand): Promise<Execution> {
    const agent = await this.agentRepository.findByIdForUser(
      command.agentId,
      command.userId
    );
    if (!agent) {
      throw new Error(`Agent not found: ${command.agentId}`);
    }

    const execution = Execution.start({
      id: randomUUID(),
      agentId: agent.id,
      userId: command.userId,
      provider: agent.provider,
      model: agent.model,
      prompt: command.prompt,
    });

    await this.executionRepository.save(execution);

    const messages: ChatMessage[] = [
      { role: "system", content: agent.systemPrompt },
      { role: "user", content: command.prompt },
    ];

    const toolDefinitions = this.toolExecutor.listDefinitions(agent.enabledTools);
    const maxIterations = command.maxToolIterations ?? 3;

    const executionStartedAt = Date.now();

    try {
      let iterations = 0;

      while (iterations < maxIterations) {
        iterations += 1;

        const llmStep = execution.addTraceStep(
          "llm_request",
          `Sending context to LLM (iteration ${iterations})`,
          { messageCount: messages.length, availableTools: toolDefinitions.map((t) => t.name) }
        );

        const llmStart = Date.now();
        let output;
        try {
          output = await this.llmProvider.generate({
            provider: agent.provider,
            model: agent.model,
            messages,
            tools: toolDefinitions,
          });
        } finally {
          llmStep.durationMs = Date.now() - llmStart;
        }

        if (output.toolCalls.length === 0) {
          const finalText = output.content ?? "";
          execution.complete(finalText, new Date(), Date.now() - executionStartedAt);
          await this.executionRepository.update(execution);
          return execution;
        }

        messages.push({
          role: "assistant",
          content: output.content ?? "",
        });

        for (const call of output.toolCalls) {
          execution.addTraceStep(
            "tool_call",
            `Model requested tool: ${call.name}`,
            { toolCallId: call.id, arguments: call.arguments }
          );

          const toolStart = Date.now();
          const result = await this.toolExecutor.execute(
            call.name,
            call.arguments,
            agent.enabledTools,
            {
              userId: command.userId,
              agentId: agent.id,
              documentIds: agent.documentIds,
            }
          );
          const toolDurationMs = Date.now() - toolStart;

          const toolOutputRecord =
            result.output && typeof result.output === "object"
              ? (result.output as Record<string, unknown>)
              : null;
          const citations =
            toolOutputRecord && Array.isArray(toolOutputRecord.citations)
              ? toolOutputRecord.citations
              : undefined;

          execution.addTraceStep(
            "tool_result",
            `Tool ${call.name} finished execution`,
            {
              toolCallId: call.id,
              isError: Boolean(result.isError),
              output: result.output,
              ...(citations ? { citations } : {}),
            },
            new Date(),
            toolDurationMs
          );

          messages.push({
            role: "tool",
            toolCallId: call.id,
            toolName: call.name,
            content: JSON.stringify(result.output),
          });
        }
      }

      throw new Error(`Maximum tool calling iterations (${maxIterations}) reached.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown execution error";
      execution.fail(message);
      await this.executionRepository.update(execution);
      return execution;
    }
  }
}
