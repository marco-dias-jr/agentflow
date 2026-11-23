import {
  ApiClientError,
  extractApiErrorMessage,
  getUserFriendlyError,
} from "./errors";

export { ApiClientError, getUserFriendlyError };

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ||
  "http://localhost:3001";

export interface UserProfileDTO {
  id: string;
  fullName: string;
  email: string;
  cpf: string;
}

export interface AgentDTO {
  id: string;
  userId: string;
  name: string;
  description: string;
  systemPrompt: string;
  provider: string;
  model: string;
  enabledTools: string[];
  documentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDTO {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  mimeType: string;
  contentHash: string;
  chunkCount: number;
  parserStrategy: "lightweight" | "strict";
  chunkStrategy: "fixed" | "paragraph" | "sentence";
  chunkSize: number;
  chunkOverlap: number;
  embeddingProvider: "gemini" | "ollama" | "local";
  embeddingModel: string;
  createdAt: string;
}

export interface IngestDocumentPayload {
  title?: string;
  fileName: string;
  mimeType?: string;
  contentBase64?: string;
  contentText?: string;
  parserStrategy?: "lightweight" | "strict";
  normalizeWhitespace?: boolean;
  chunkStrategy?: "fixed" | "paragraph" | "sentence";
  chunkSize?: number;
  chunkOverlap?: number;
  embeddingProvider?: "auto" | "gemini" | "ollama" | "local";
  embeddingModel?: string;
}

export interface IngestDocumentResponseDTO {
  document: DocumentDTO;
  deduplicated: boolean;
}

export interface KnowledgeCitationDTO {
  citation: string;
  documentId?: string;
  title: string;
  chunkIndex: number;
  score: number;
  snippet: string;
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
  durationMs?: number;
}

export interface ExecutionDTO {
  id: string;
  agentId: string;
  userId: string;
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
  provider: string;
  model: string;
  enabledTools: string[];
  documentIds?: string[];
}

export interface ModelOptionDTO {
  id: string;
  label: string;
  provider: string;
  providerLabel: string;
}

export interface UpdateAgentPayload {
  name?: string;
  description?: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  enabledTools?: string[];
  documentIds?: string[];
}

interface ApiRequestOptions extends RequestInit {
  fallbackError: string;
  allowUnauthorizedNull?: boolean;
}

async function safeParseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions
): Promise<T> {
  const { fallbackError, allowUnauthorizedNull, headers, ...init } = options;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
    });
  } catch (err) {
    throw new ApiClientError(getUserFriendlyError(err, fallbackError), {
      code: "NETWORK_ERROR",
    });
  }

  if (allowUnauthorizedNull && res.status === 401) {
    return null as T;
  }

  const payload = await safeParseJson(res);

  if (!res.ok) {
    const friendlyMessage = extractApiErrorMessage(
      res.status,
      payload,
      fallbackError
    );
    throw new ApiClientError(friendlyMessage, { status: res.status });
  }

  return payload as T;
}

export async function getMe(): Promise<UserProfileDTO | null> {
  const json = await apiRequest<{ data: UserProfileDTO } | null>("/auth/me", {
    cache: "no-store",
    allowUnauthorizedNull: true,
    fallbackError:
      "We couldn't verify your session right now. Please refresh the page.",
  });
  return json ? json.data : null;
}

export async function registerAccount(payload: {
  fullName: string;
  email: string;
  cpf: string;
  password: string;
}): Promise<UserProfileDTO> {
  const json = await apiRequest<{ data: UserProfileDTO }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackError:
      "We couldn't create your account right now. Please check your details and try again.",
  });
  return json.data;
}

export async function loginAccount(payload: {
  email: string;
  password: string;
}): Promise<UserProfileDTO> {
  const json = await apiRequest<{ data: UserProfileDTO }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackError:
      "We couldn't sign you in right now. Please check your credentials and try again.",
  });
  return json.data;
}

export async function logoutAccount(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Allow local state cleanup even if network is offline during sign-out
  }
}

export async function requestPasswordResetCode(email: string): Promise<string> {
  const json = await apiRequest<{ data: { message: string } }>(
    "/auth/forgot-password",
    {
      method: "POST",
      body: JSON.stringify({ email }),
      fallbackError:
        "We couldn't send the verification code right now. Please try again in a moment.",
    }
  );
  return json.data.message;
}

export async function confirmPasswordReset(payload: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<string> {
  const json = await apiRequest<{ data: { message: string } }>(
    "/auth/reset-password",
    {
      method: "POST",
      body: JSON.stringify(payload),
      fallbackError:
        "We couldn't reset your password. Please verify your 6-digit code and try again.",
    }
  );
  return json.data.message;
}

export async function listModels(): Promise<{
  models: ModelOptionDTO[];
}> {
  const json = await apiRequest<{ data: { models: ModelOptionDTO[] } }>(
    "/models",
    {
      cache: "no-store",
      fallbackError:
        "We couldn't load the available AI models right now. Please try again shortly.",
    }
  );
  return json.data;
}

export async function listAgents(): Promise<AgentDTO[]> {
  const json = await apiRequest<{ data: AgentDTO[] }>("/agents", {
    cache: "no-store",
    fallbackError:
      "We couldn't load your agents right now. Please check your connection and try again.",
  });
  return json.data;
}

export async function createAgent(
  payload: CreateAgentPayload
): Promise<AgentDTO> {
  const json = await apiRequest<{ data: AgentDTO }>("/agents", {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackError:
      "We couldn't create the agent right now. Please review the configuration and try again.",
  });
  return json.data;
}

export async function updateAgent(
  agentId: string,
  payload: UpdateAgentPayload
): Promise<AgentDTO> {
  const json = await apiRequest<{ data: AgentDTO }>(`/agents/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    fallbackError:
      "We couldn't save your changes to this agent. Please try again.",
  });
  return json.data;
}

export async function deleteAgent(agentId: string): Promise<void> {
  await apiRequest<unknown>(`/agents/${agentId}`, {
    method: "DELETE",
    fallbackError:
      "We couldn't delete this agent right now. Please try again in a moment.",
  });
}

export async function executeAgentPrompt(
  agentId: string,
  prompt: string
): Promise<ExecutionDTO> {
  const json = await apiRequest<{ data: ExecutionDTO }>(
    `/agents/${agentId}/executions`,
    {
      method: "POST",
      body: JSON.stringify({ prompt }),
      fallbackError:
        "The agent couldn't process your request right now. Please try sending your message again.",
    }
  );
  return json.data;
}

export async function listExecutions(agentId: string): Promise<ExecutionDTO[]> {
  const json = await apiRequest<{ data: ExecutionDTO[] }>(
    `/agents/${agentId}/executions`,
    {
      cache: "no-store",
      fallbackError:
        "We couldn't load the execution history for this agent right now.",
    }
  );
  return json.data;
}

export async function listDocuments(): Promise<DocumentDTO[]> {
  const json = await apiRequest<{ data: DocumentDTO[] }>("/documents", {
    cache: "no-store",
    fallbackError:
      "We couldn't load your account documents right now. Please try again shortly.",
  });
  return json.data;
}

export async function uploadDocument(
  payload: IngestDocumentPayload
): Promise<IngestDocumentResponseDTO> {
  const json = await apiRequest<{ data: IngestDocumentResponseDTO }>(
    "/documents",
    {
      method: "POST",
      body: JSON.stringify(payload),
      fallbackError:
        "We couldn't upload and index this document right now. Please check the file and try again.",
    }
  );
  return json.data;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await apiRequest<unknown>(`/documents/${documentId}`, {
    method: "DELETE",
    fallbackError:
      "We couldn't delete this document right now. Please try again in a moment.",
  });
}
