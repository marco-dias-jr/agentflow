export type ExecutionStatus = "running" | "completed" | "failed";

export interface TraceStep {
  step: number;
  type: "user_message" | "llm_request" | "tool_call" | "tool_result" | "assistant_response" | "error";
  summary: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  durationMs?: number;
}

export interface ExecutionProps {
  id: string;
  agentId: string;
  userId: string;
  provider: string;
  model: string;
  prompt: string;
  status: ExecutionStatus;
  response: string | null;
  trace: TraceStep[];
  createdAt: Date;
  completedAt: Date | null;
}

export interface StartExecutionInput {
  id: string;
  agentId: string;
  userId: string;
  provider: string;
  model: string;
  prompt: string;
  now?: Date;
}

export type CreateExecutionInput = StartExecutionInput;

export class Execution {
  public readonly id: string;
  public readonly agentId: string;
  public readonly userId: string;
  public readonly provider: string;
  public readonly model: string;
  public readonly prompt: string;
  public status: ExecutionStatus;
  public response: string | null;
  public trace: TraceStep[];
  public readonly createdAt: Date;
  public completedAt: Date | null;

  private constructor(props: ExecutionProps) {
    this.id = props.id;
    this.agentId = props.agentId;
    this.userId = props.userId;
    this.provider = props.provider;
    this.model = props.model;
    this.prompt = props.prompt;
    this.status = props.status;
    this.response = props.response;
    this.trace = props.trace;
    this.createdAt = props.createdAt;
    this.completedAt = props.completedAt;
  }

  public static start(input: StartExecutionInput): Execution {
    if (!input.id.trim()) {
      throw new Error("Execution id is required.");
    }
    if (!input.agentId.trim()) {
      throw new Error("Execution agentId is required.");
    }
    if (!input.userId || !input.userId.trim()) {
      throw new Error("Execution userId is required.");
    }
    if (!input.prompt.trim()) {
      throw new Error("Execution prompt is required.");
    }

    const timestamp = input.now ?? new Date();
    const initialStep: TraceStep = {
      step: 1,
      type: "user_message",
      summary: "Received user prompt",
      payload: { prompt: input.prompt.trim() },
      timestamp: timestamp.toISOString(),
    };

    return new Execution({
      id: input.id.trim(),
      agentId: input.agentId.trim(),
      userId: input.userId.trim(),
      provider: input.provider.trim(),
      model: input.model.trim(),
      prompt: input.prompt.trim(),
      status: "running",
      response: null,
      trace: [initialStep],
      createdAt: timestamp,
      completedAt: null,
    });
  }

  public addTraceStep(
    type: TraceStep["type"],
    summary: string,
    payload?: Record<string, unknown>,
    now: Date = new Date(),
    durationMs?: number
  ): TraceStep {
    const nextStepNumber = this.trace.length + 1;
    const step: TraceStep = {
      step: nextStepNumber,
      type,
      summary,
      payload,
      timestamp: now.toISOString(),
      ...(durationMs !== undefined ? { durationMs } : {}),
    };
    this.trace.push(step);
    return step;
  }

  public complete(
    responseText: string,
    now: Date = new Date(),
    durationMs?: number
  ): void {
    this.status = "completed";
    this.response = responseText;
    this.completedAt = now;
    this.addTraceStep(
      "assistant_response",
      "Generated final response",
      { responseLength: responseText.length },
      now,
      durationMs
    );
  }

  public fail(errorMessage: string, now: Date = new Date()): void {
    this.status = "failed";
    this.completedAt = now;
    this.addTraceStep("error", errorMessage, undefined, now);
  }
}
