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

export interface ModelOptionDTO {
  id: string;
  label: string;
  provider: "gemini" | "groq" | "ollama";
}

export interface UpdateAgentPayload {
  name?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  enabledTools?: string[];
}

export async function listModels(): Promise<{
  activeProvider: string;
  models: ModelOptionDTO[];
}> {
  const res = await fetch(`${API_BASE_URL}/models`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load models (${res.status})`);
  }
  const json = (await res.json()) as {
    data: { activeProvider: string; models: ModelOptionDTO[] };
  };
  return json.data;
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

export async function updateAgent(
  agentId: string,
  payload: UpdateAgentPayload
): Promise<AgentDTO> {
  const res = await fetch(`${API_BASE_URL}/agents/${agentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Failed to update agent (${res.status})`);
  }
  return json.data as AgentDTO;
}

export async function deleteAgent(agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/agents/${agentId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    let message = `Failed to delete agent (${res.status})`;
    try {
      const json = (await res.json()) as { message?: string };
      if (json.message) message = json.message;
    } catch {
      // 204 No Content has empty body
    }
    throw new Error(message);
  }
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
