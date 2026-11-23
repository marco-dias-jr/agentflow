export class ApiClientError extends Error {
  public readonly status?: number;
  public readonly code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = "ApiClientError";
    this.status = options?.status;
    this.code = options?.code;
  }
}

const NETWORK_ERROR_PATTERNS = [
  /failed to fetch/i,
  /networkerror when attempting to fetch/i,
  /network request failed/i,
  /load failed/i,
  /fetch failed/i,
  /econnrefused/i,
  /err_network/i,
  /err_connection_refused/i,
  /socket hang up/i,
];

const TIMEOUT_ERROR_PATTERNS = [
  /aborterror/i,
  /timed? out/i,
  /the operation was aborted/i,
  /deadline exceeded/i,
];

const TECHNICAL_SERVER_PATTERNS = [
  /unexpected token/i,
  /is not valid json/i,
  /json\.parse/i,
  /internal server error/i,
  /syntaxerror/i,
  /typeerror/i,
  /referenceerror/i,
  /relation ".*" does not exist/i,
  /duplicate key value violates unique constraint/i,
  /connect econnrefused/i,
  /database error/i,
  /prisma/i,
  /drizzle/i,
  /postgres/i,
];

const FRIENDLY_MESSAGE_OVERRIDES: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  {
    pattern: /^invalid login payload$/i,
    replacement: "Please enter a valid email address and password.",
  },
  {
    pattern: /^invalid registration data$/i,
    replacement:
      "Please check your registration details and make sure all fields are filled out correctly.",
  },
  {
    pattern: /^invalid forgot-password payload$/i,
    replacement: "Please enter a valid registered email address.",
  },
  {
    pattern: /^invalid reset-password payload$/i,
    replacement:
      "Please check the 6-digit verification code and ensure your new password meets the requirements.",
  },
  {
    pattern: /^invalid agent( update)? payload$/i,
    replacement:
      "Please review the agent configuration fields and try saving again.",
  },
  {
    pattern: /^invalid document upload payload$/i,
    replacement:
      "We couldn't process this document. Please check the file format and indexing settings.",
  },
  {
    pattern: /^invalid execution payload$/i,
    replacement: "Please enter a valid message before sending.",
  },
  {
    pattern: /^agent not found(?::.*)?$/i,
    replacement:
      "This agent could not be found. It may have been removed—please refresh your workspace.",
  },
  {
    pattern: /^unauthorized$/i,
    replacement: "Your session has expired. Please sign in again to continue.",
  },
  {
    pattern: /^forbidden$/i,
    replacement: "You don't have permission to perform this action.",
  },
];

const FIELD_LABELS: Record<string, string> = {
  fullName: "Full name",
  email: "Email",
  cpf: "CPF",
  password: "Password",
  newPassword: "New password",
  code: "Verification code",
  name: "Agent name",
  description: "Description",
  systemPrompt: "System prompt",
  provider: "Provider",
  model: "Model",
  prompt: "Prompt",
  fileName: "File name",
  title: "Document title",
};

function formatValidationIssues(
  issues?: Record<string, string[] | undefined>
): string | null {
  if (!issues || typeof issues !== "object") return null;

  for (const [field, messages] of Object.entries(issues)) {
    if (!Array.isArray(messages) || messages.length === 0) continue;
    const first = messages[0]?.trim();
    if (!first) continue;

    const label = FIELD_LABELS[field] ?? field;
    if (/^string must contain at least (\d+) character/i.test(first)) {
      const match = first.match(/(\d+)/);
      return `${label} must be at least ${match?.[1] ?? "the minimum"} characters long.`;
    }
    if (/^invalid email/i.test(first)) {
      return "Please enter a valid email address.";
    }
    if (/^required$/i.test(first)) {
      return `Please fill in the ${label.toLowerCase()} field.`;
    }
    if (first.toLowerCase().startsWith(label.toLowerCase())) {
      return first.endsWith(".") ? first : `${first}.`;
    }
    return `${label}: ${first.endsWith(".") ? first : `${first}.`}`;
  }

  return null;
}

export function humanizeRawMessage(
  rawMessage: string,
  fallbackMessage: string
): string {
  const trimmed = rawMessage.trim();
  if (!trimmed) return fallbackMessage;

  if (NETWORK_ERROR_PATTERNS.some((regex) => regex.test(trimmed))) {
    return "Unable to connect to the server right now. Please check your internet connection and try again.";
  }

  if (TIMEOUT_ERROR_PATTERNS.some((regex) => regex.test(trimmed))) {
    return "The request took too long to respond. Please try again in a moment.";
  }

  if (TECHNICAL_SERVER_PATTERNS.some((regex) => regex.test(trimmed))) {
    return "Something went wrong on our end while processing your request. Please try again shortly.";
  }

  // Strip raw trailing HTTP status codes like "Login failed (500)"
  const withoutStatusSuffix = trimmed.replace(/\s*\(\d{3}\)\s*\.?$/, "").trim();

  for (const { pattern, replacement } of FRIENDLY_MESSAGE_OVERRIDES) {
    if (pattern.test(withoutStatusSuffix)) {
      return replacement;
    }
  }

  // Avoid generic raw fallback strings like "Request failed" or "Error"
  if (/^(request|operation|fetch|error|http error)\s*(failed)?$/i.test(withoutStatusSuffix)) {
    return fallbackMessage;
  }

  return withoutStatusSuffix.endsWith(".") ||
    withoutStatusSuffix.endsWith("!") ||
    withoutStatusSuffix.endsWith("?")
    ? withoutStatusSuffix
    : `${withoutStatusSuffix}.`;
}

export function getStatusFallbackMessage(
  status: number,
  contextFallback: string
): string {
  if (status === 401) {
    return "Your session has expired or your credentials are invalid. Please sign in again.";
  }
  if (status === 403) {
    return "You do not have permission to perform this action.";
  }
  if (status === 404) {
    return "The requested item could not be found. Please refresh and try again.";
  }
  if (status === 409) {
    return "This information is already registered or conflicts with an existing record.";
  }
  if (status === 413) {
    return "The file or content you tried to send exceeds the maximum allowed size.";
  }
  if (status === 429) {
    return "Too many attempts in a short period. Please wait a moment before trying again.";
  }
  if (status >= 500) {
    return "The service is temporarily unavailable. Please try again in a few moments.";
  }
  return contextFallback;
}

export function extractApiErrorMessage(
  status: number,
  payload: unknown,
  contextFallback: string
): string {
  if (payload && typeof payload === "object") {
    const record = payload as {
      message?: unknown;
      error?: unknown;
      issues?: Record<string, string[] | undefined>;
    };

    const issueMsg = formatValidationIssues(record.issues);
    if (issueMsg) {
      return issueMsg;
    }

    if (Array.isArray(record.message) && record.message.length > 0) {
      const firstMsg = String(record.message[0] ?? "").trim();
      if (firstMsg) {
        return humanizeRawMessage(
          firstMsg,
          getStatusFallbackMessage(status, contextFallback)
        );
      }
    }

    if (typeof record.message === "string" && record.message.trim()) {
      return humanizeRawMessage(
        record.message,
        getStatusFallbackMessage(status, contextFallback)
      );
    }

    if (typeof record.error === "string" && record.error.trim()) {
      return humanizeRawMessage(
        record.error,
        getStatusFallbackMessage(status, contextFallback)
      );
    }
  }

  return getStatusFallbackMessage(status, contextFallback);
}

export function getUserFriendlyError(
  error: unknown,
  fallbackMessage = "Something went wrong. Please try again."
): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "The request took too long to respond. Please try again in a moment.";
    }
    return humanizeRawMessage(error.message, fallbackMessage);
  }

  if (typeof error === "string" && error.trim()) {
    return humanizeRawMessage(error, fallbackMessage);
  }

  return fallbackMessage;
}
