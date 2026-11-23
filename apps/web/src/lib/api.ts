const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ||
  "http://localhost:3001";

export interface AgentDTO {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  enabledTools: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TraceStepDTO {
  step: number;
  type:
    | "user_message"
    | "llm_request"
    | "tool_call"
    | "tool_result"
    | "assistant_response"
    | "error";
  summary: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

export interface ExecutionDTO {
  id: string;
  agentId: string;
  provider: string;
  model: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  response: string | null;
  trace: TraceStepDTO[];
  createdAt: string;
  completedAt: string | null;
}

export interface CreateAgentPayload {
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  enabledTools: string[];
}

export async function listAgents(): Promise<AgentDTO[]> {
  const res = await fetch(`${API_BASE_URL}/agents`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load agents (${res.status})`);
  }
  const json = (await res.json()) as { data: AgentDTO[] };
  return json.data;
}

export async function createAgent(payload: CreateAgentPayload): Promise<AgentDTO> {
  const res = await fetch(`${API_BASE_URL}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Failed to create agent (${res.status})`);
  }
  return json.data as AgentDTO;
}

export async function executeAgentPrompt(
  agentId: string,
  prompt: string
): Promise<ExecutionDTO> {
  const res = await fetch(`${API_BASE_URL}/agents/${agentId}/executions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Failed to execute agent (${res.status})`);
  }
  return json.data as ExecutionDTO;
}

export async function listExecutions(agentId: string): Promise<ExecutionDTO[]> {
  const res = await fetch(`${API_BASE_URL}/agents/${agentId}/executions`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load executions (${res.status})`);
  }
  const json = (await res.json()) as { data: ExecutionDTO[] };
  return json.data;
}
