"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Bot,
  Cpu,
  FileText,
  FolderOpen,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card, SurfaceInset } from "@/components/ui/Card";
import { AgentFormModal } from "@/components/ui/AgentFormModal";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { SelectActiveAgentModal } from "@/components/ui/SelectActiveAgentModal";
import { DocumentSelector } from "@/components/ui/DocumentSelector";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/Input";
import { ToolSelector } from "@/components/ui/ToolSelector";
import {
  AgentDTO,
  createAgent,
  deleteAgent,
  deleteDocument,
  DocumentDTO,
  executeAgentPrompt,
  ExecutionDTO,
  getMe,
  getUserFriendlyError,
  KnowledgeCitationDTO,
  listAgents,
  listDocuments,
  listExecutions,
  listModels,
  logoutAccount,
  ModelOptionDTO,
  TraceStepDTO,
  updateAgent,
  UserProfileDTO,
} from "@/lib/api";

const AVAILABLE_TOOLS = [
  { id: "calculator", label: "Calculator" },
  { id: "knowledge_search", label: "Knowledge Search" },
];

type ActiveTab = "chats" | "agents" | "documents";

function formatShortName(fullName?: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] || "";
}

function extractStepCitations(step: TraceStepDTO): KnowledgeCitationDTO[] {
  if (!step.payload) return [];

  const direct = step.payload.citations;
  const outputObj =
    step.payload.output && typeof step.payload.output === "object"
      ? (step.payload.output as Record<string, unknown>)
      : null;
  const rawList = Array.isArray(direct)
    ? direct
    : outputObj && Array.isArray(outputObj.citations)
      ? outputObj.citations
      : outputObj && Array.isArray(outputObj.matches)
        ? outputObj.matches
        : [];

  return rawList.filter((item): item is KnowledgeCitationDTO => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return (
      typeof record.citation === "string" &&
      typeof record.score === "number" &&
      typeof record.snippet === "string"
    );
  });
}

export default function AgentFlowPage() {
  const [currentUser, setCurrentUser] = useState<UserProfileDTO | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<ActiveTab>("chats");

  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [models, setModels] = useState<ModelOptionDTO[]>([]);
  const [executions, setExecutions] = useState<ExecutionDTO[]>([]);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string>("");

  // Create agent form state
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful operational assistant. Use available tools when accurate calculations or runbooks are needed."
  );
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [createDocumentIds, setCreateDocumentIds] = useState<string[]>([]);

  // Edit selected agent state
  const [isEditing, setIsEditing] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [editProvider, setEditProvider] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editTools, setEditTools] = useState<string[]>([]);
  const [editDocumentIds, setEditDocumentIds] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Chat prompt state
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete confirmation modals
  const [agentToDelete, setAgentToDelete] = useState<AgentDTO | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentDTO | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Active agent selector modal & Configured agents search
  const [isSelectAgentModalOpen, setIsSelectAgentModalOpen] = useState(false);
  const [agentSearchQuery, setAgentSearchQuery] = useState("");

  // Theme state ("dark" = Black UI, "light" = White UI)
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem("agentflow-theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  function toggleTheme(nextTheme?: "dark" | "light") {
    const resolved = nextTheme ?? (theme === "dark" ? "light" : "dark");
    setTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
    window.localStorage.setItem("agentflow-theme", resolved);
  }

  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? null;

  const filteredConfiguredAgents = useMemo(() => {
    const q = agentSearchQuery.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(q) ||
        (agent.description && agent.description.toLowerCase().includes(q)) ||
        agent.provider.toLowerCase().includes(q) ||
        agent.model.toLowerCase().includes(q)
    );
  }, [agents, agentSearchQuery]);

  const selectedExecution =
    executions.find((exec) => exec.id === selectedExecutionId) ??
    executions[0] ??
    null;

  const availableProviders = useMemo(() => {
    return Array.from(
      new Map(models.map((m) => [m.provider, m.providerLabel])).entries()
    ).map(([id, label]) => ({ id, label }));
  }, [models]);

  const createModelsForProvider = useMemo(() => {
    return models.filter((m) => m.provider === provider);
  }, [models, provider]);

  const editModelsForProvider = useMemo(() => {
    return models.filter((m) => m.provider === editProvider);
  }, [models, editProvider]);

  async function refreshModels() {
    try {
      const data = await listModels();
      setModels(data.models);
      if (data.models.length > 0) {
        const first = data.models[0];
        setProvider((prev) =>
          data.models.some((m) => m.provider === prev) ? prev : first.provider
        );
        setModel((prev) =>
          data.models.some((m) => m.id === prev) ? prev : first.id
        );
      } else {
        setProvider("");
        setModel("");
      }
    } catch (err) {
      setErrorMessage(
        getUserFriendlyError(
          err,
          "We couldn't load the available AI models right now. Please try again shortly."
        )
      );
    }
  }

  async function refreshDocuments() {
    try {
      const data = await listDocuments();
      setDocuments(data);
    } catch (err) {
      setErrorMessage(
        getUserFriendlyError(
          err,
          "We couldn't load your account documents right now. Please try again shortly."
        )
      );
    }
  }

  async function refreshAgents(preferredId?: string) {
    try {
      const data = await listAgents();
      setAgents(data);
      if (preferredId && data.some((a) => a.id === preferredId)) {
        setSelectedAgentId(preferredId);
      } else if (!data.some((a) => a.id === selectedAgentId)) {
        setSelectedAgentId(data[0]?.id ?? "");
      }
    } catch (err) {
      setErrorMessage(
        getUserFriendlyError(
          err,
          "We couldn't load your agents right now. Please check your connection and try again."
        )
      );
    }
  }

  async function refreshExecutions(agentId: string, preferredExecId?: string) {
    if (!agentId) {
      setExecutions([]);
      setSelectedExecutionId("");
      return;
    }
    try {
      const data = await listExecutions(agentId);
      setExecutions(data);
      if (preferredExecId) {
        setSelectedExecutionId(preferredExecId);
      } else if (data.length > 0) {
        setSelectedExecutionId(data[0].id);
      } else {
        setSelectedExecutionId("");
      }
    } catch (err) {
      setErrorMessage(
        getUserFriendlyError(
          err,
          "We couldn't load the execution history for this agent right now."
        )
      );
    }
  }

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const user = await getMe();
        if (active) {
          setCurrentUser(user);
        }
      } catch {
        if (active) {
          setCurrentUser(null);
        }
      } finally {
        if (active) {
          setIsCheckingAuth(false);
        }
      }
    }
    void checkSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    void refreshModels();
    void refreshAgents();
    void refreshDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    setIsEditing(false);
    setEditingAgentId(null);
    if (currentUser && selectedAgentId) {
      void refreshExecutions(selectedAgentId);
    } else {
      setExecutions([]);
      setSelectedExecutionId("");
    }
  }, [currentUser, selectedAgentId]);

  async function handleSignOut() {
    await logoutAccount();
    setCurrentUser(null);
    setAgents([]);
    setSelectedAgentId("");
    setDocuments([]);
    setCreateDocumentIds([]);
    setEditDocumentIds([]);
    setExecutions([]);
    setSelectedExecutionId("");
    setModels([]);
    setProvider("");
    setModel("");
    setErrorMessage(null);
  }

  function handleCreateProviderChange(nextProvider: string) {
    setProvider(nextProvider);
    const firstModel = models.find((m) => m.provider === nextProvider);
    setModel(firstModel?.id ?? "");
  }

  function handleEditProviderChange(nextProvider: string) {
    setEditProvider(nextProvider);
    const firstModel = models.find((m) => m.provider === nextProvider);
    setEditModel(firstModel?.id ?? "");
  }

  function openCreateForm() {
    setName("");
    setDescription("");
    setSystemPrompt(
      "You are a helpful operational assistant. Use available tools when accurate calculations or runbooks are needed."
    );
    if (models.length > 0) {
      const first = models[0];
      setProvider(first.provider);
      setModel(first.id);
    }
    setEnabledTools([]);
    setCreateDocumentIds([]);
    setIsCreatingAgent(true);
  }

  function openEditForm(agent: AgentDTO) {
    setEditingAgentId(agent.id);
    setEditName(agent.name);
    setEditDescription(agent.description);
    setEditSystemPrompt(agent.systemPrompt);
    setEditProvider(agent.provider);
    setEditModel(agent.model);
    setEditTools(agent.enabledTools);
    setEditDocumentIds(agent.documentIds ?? []);
    setIsEditing(true);
  }

  function toggleCreateTool(toolId: string) {
    setEnabledTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((item) => item !== toolId)
        : [...prev, toolId]
    );
  }

  function toggleEditTool(toolId: string) {
    setEditTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((item) => item !== toolId)
        : [...prev, toolId]
    );
  }

  function toggleCreateDocument(docId: string) {
    setCreateDocumentIds((prev) =>
      prev.includes(docId)
        ? prev.filter((item) => item !== docId)
        : [...prev, docId]
    );
  }

  function toggleEditDocument(docId: string) {
    setEditDocumentIds((prev) =>
      prev.includes(docId)
        ? prev.filter((item) => item !== docId)
        : [...prev, docId]
    );
  }

  function handleDocumentUploaded(doc: DocumentDTO) {
    setDocuments((prev) => {
      if (prev.some((item) => item.id === doc.id)) {
        return prev;
      }
      return [doc, ...prev];
    });
  }

  async function handleConfirmDeleteDocument() {
    if (!documentToDelete) return;
    setIsConfirmingDelete(true);
    try {
      await deleteDocument(documentToDelete.id);
      setDocuments((prev) => prev.filter((item) => item.id !== documentToDelete.id));
      setCreateDocumentIds((prev) => prev.filter((id) => id !== documentToDelete.id));
      setEditDocumentIds((prev) => prev.filter((id) => id !== documentToDelete.id));
      setAgents((prev) =>
        prev.map((agent) => ({
          ...agent,
          documentIds: (agent.documentIds ?? []).filter((id) => id !== documentToDelete.id),
        }))
      );
      setDocumentToDelete(null);
    } catch (err) {
      setErrorMessage(
        getUserFriendlyError(
          err,
          "We couldn't delete this document right now. Please try again."
        )
      );
    } finally {
      setIsConfirmingDelete(false);
    }
  }

  async function handleConfirmDeleteAgent() {
    if (!agentToDelete) return;
    setIsConfirmingDelete(true);
    setErrorMessage(null);
    try {
      await deleteAgent(agentToDelete.id);
      const remaining = agents.filter((item) => item.id !== agentToDelete.id);
      setAgents(remaining);
      if (selectedAgentId === agentToDelete.id) {
        setSelectedAgentId(remaining[0]?.id ?? "");
      }
      if (editingAgentId === agentToDelete.id) {
        setIsEditing(false);
        setEditingAgentId(null);
      }
      setAgentToDelete(null);
    } catch (err) {
      setErrorMessage(
        getUserFriendlyError(
          err,
          "We couldn't delete this agent right now. Please try again in a moment."
        )
      );
    } finally {
      setIsConfirmingDelete(false);
    }
  }

  async function handleCreateAgent(e: FormEvent) {
    e.preventDefault();
    if (!provider || !model) {
      setErrorMessage(
        "Configure at least one provider and model in your environment (.env)."
      );
      return;
    }
    setErrorMessage(null);
    setIsCreating(true);
    try {
      const created = await createAgent({
        name,
        description,
        systemPrompt,
        provider,
        model,
        enabledTools,
        documentIds: createDocumentIds,
      });
      setName("");
      setDescription("");
      setEnabledTools([]);
      setCreateDocumentIds([]);
      setIsCreatingAgent(false);
      await refreshAgents(created.id);
    } catch (err) {
      setErrorMessage(
        getUserFriendlyError(
          err,
          "We couldn't create the agent right now. Please review the configuration and try again."
        )
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    const targetAgentId = editingAgentId || selectedAgent?.id;
    if (!targetAgentId) return;
    setErrorMessage(null);
    setIsSavingEdit(true);
    try {
      const updated = await updateAgent(targetAgentId, {
        name: editName,
        description: editDescription,
        systemPrompt: editSystemPrompt,
        provider: editProvider,
        model: editModel,
        enabledTools: editTools,
        documentIds: editDocumentIds,
      });
      setIsEditing(false);
      setEditingAgentId(null);
      await refreshAgents(updated.id);
    } catch (err) {
      setErrorMessage(
        getUserFriendlyError(
          err,
          "We couldn't save your changes to this agent. Please try again."
        )
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleRunPrompt(e: FormEvent) {
    e.preventDefault();
    if (!selectedAgentId || !prompt.trim()) return;
    setErrorMessage(null);
    setIsRunning(true);
    try {
      const result = await executeAgentPrompt(selectedAgentId, prompt.trim());
      setPrompt("");
      await refreshExecutions(selectedAgentId, result.id);
    } catch (err) {
      setErrorMessage(
        getUserFriendlyError(
          err,
          "The agent couldn't process your request right now. Please try sending your message again."
        )
      );
    } finally {
      setIsRunning(false);
    }
  }

  if (isCheckingAuth) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        Checking session...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthGate
        onAuthenticated={(user) => setCurrentUser(user)}
        theme={theme}
        onToggleTheme={(nextTheme) => toggleTheme(nextTheme)}
      />
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top Main Header */}
      <div className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-3">
              <BrandMark />
              <h1
                className="font-display text-2xl font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                AgentFlow
              </h1>
            </div>
            <p
              className="text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Enterprise AI agent orchestration, live traces, and verified citations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ThemeSwitcher
              theme={theme}
              onToggleTheme={(nextTheme) => toggleTheme(nextTheme)}
            />

            <div className="flex items-center gap-3 py-1 pl-3.5 pr-1.5">
              <div className="text-right text-xs leading-tight">
                <div
                  className="font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatShortName(currentUser.fullName)}
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {currentUser.email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="af-btn-secondary rounded-[4px] px-3 py-1.5 text-xs font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Sticky Navbar Directly Below Header */}
      <nav
        aria-label="Main workflow navigation"
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{
          backgroundColor: "var(--bg-glass)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-1.5 overflow-x-auto py-2">
            <button
              type="button"
              onClick={() => setActiveTab("chats")}
              className={`flex items-center gap-2 rounded-[4px] px-3.5 py-2 text-xs font-semibold transition-all ${
                activeTab === "chats"
                  ? "af-btn-primary shadow-xs"
                  : "af-btn-secondary"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Chats &amp; Traces</span>
              {executions.length > 0 && (
                <span
                  className="font-mono-tech ml-0.5 rounded-[4px] px-1.5 py-0.2 text-[10px]"
                  style={{
                    backgroundColor:
                      activeTab === "chats"
                        ? "rgba(0,0,0,0.2)"
                        : "var(--badge-bg)",
                  }}
                >
                  {executions.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("agents")}
              className={`flex items-center gap-2 rounded-[4px] px-3.5 py-2 text-xs font-semibold transition-all ${
                activeTab === "agents"
                  ? "af-btn-primary shadow-xs"
                  : "af-btn-secondary"
              }`}
            >
              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Agents Management</span>
              <span
                className="font-mono-tech ml-0.5 rounded-[4px] px-1.5 py-0.2 text-[10px]"
                style={{
                  backgroundColor:
                    activeTab === "agents"
                      ? "rgba(0,0,0,0.2)"
                      : "var(--badge-bg)",
                }}
              >
                {agents.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("documents")}
              className={`flex items-center gap-2 rounded-[4px] px-3.5 py-2 text-xs font-semibold transition-all ${
                activeTab === "documents"
                  ? "af-btn-primary shadow-xs"
                  : "af-btn-secondary"
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Account Documents</span>
              <span
                className="font-mono-tech ml-0.5 rounded-[4px] px-1.5 py-0.2 text-[10px]"
                style={{
                  backgroundColor:
                    activeTab === "documents"
                      ? "rgba(0,0,0,0.2)"
                      : "var(--badge-bg)",
                }}
              >
                {documents.length}
              </span>
            </button>
          </div>

          {/* Quick Active Agent indicator in navbar when on Chats tab */}
          {activeTab === "chats" && selectedAgent && (
            <div className="hidden items-center gap-2 text-xs md:flex">
              <span style={{ color: "var(--text-muted)" }}>Active Agent:</span>
              <span
                className="rounded-[4px] border px-2 py-0.5 font-semibold"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              >
                {selectedAgent.name}
              </span>
            </div>
          )}
        </div>
      </nav>

      {/* Main Container Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {errorMessage && (
          <AlertBanner
            variant="error"
            className="mb-6 rounded-[4px] px-4 py-3 text-sm"
            onDismiss={() => setErrorMessage(null)}
          >
            {errorMessage}
          </AlertBanner>
        )}

        {/* =========================================================================
            TAB 1: CHATS & TRACES
        ========================================================================= */}
        {activeTab === "chats" && (
          <div className="space-y-6">
            {/* Active Agent Selector Bar & Detailed Properties Summary */}
            <Card className="rounded-[4px] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 shrink-0" style={{ color: "var(--text-primary)" }} />
                    <span className="font-display text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                      Active Agent
                    </span>
                  </div>

                  {agents.length === 0 ? (
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      No agents available.{" "}
                      <button
                        type="button"
                        onClick={openCreateForm}
                        className="underline hover:opacity-100 font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Create an agent first
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSelectAgentModalOpen(true)}
                      className="af-surface-inset inline-flex items-center gap-2 rounded-[4px] border px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-90"
                      style={{
                        borderColor: "var(--border-strong)",
                        color: "var(--text-primary)",
                      }}
                      title="Switch active agent"
                    >
                      <span className="truncate max-w-[220px]">
                        {selectedAgent?.name || "Choose an Agent"}
                      </span>
                      <span
                        className="font-mono-tech text-[10px] opacity-70"
                        style={{ color: "var(--text-muted)" }}
                      >
                        ({selectedAgent?.provider}/{selectedAgent?.model})
                      </span>
                      <ArrowLeftRight className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {selectedAgent && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        openEditForm(selectedAgent);
                        setActiveTab("agents");
                      }}
                      className="rounded-[4px] px-3 py-1.5 text-xs font-medium"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Configure Agent</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Agent Properties Summary Card Header */}
              {selectedAgent ? (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2
                        className="font-display text-base font-bold tracking-tight"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {selectedAgent.name}
                      </h2>
                      <p
                        className="mt-0.5 text-xs leading-relaxed"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {selectedAgent.description || "No description provided."}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Model Badge */}
                      <span
                        className="font-mono-tech inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: "var(--badge-bg)",
                          borderColor: "var(--badge-border)",
                          color: "var(--badge-text)",
                        }}
                      >
                        <Cpu className="h-3 w-3 opacity-75" />
                        {selectedAgent.provider} / {selectedAgent.model}
                      </span>

                      {/* Linked Documents Count Badge */}
                      <span
                        className="font-mono-tech inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: "var(--badge-bg)",
                          borderColor: "var(--badge-border)",
                          color: "var(--badge-text)",
                        }}
                      >
                        <FileText className="h-3 w-3 opacity-75" />
                        {(selectedAgent.documentIds ?? []).length}{" "}
                        {(selectedAgent.documentIds ?? []).length === 1
                          ? "Linked Document"
                          : "Linked Documents"}
                      </span>
                    </div>
                  </div>

                  {/* Assigned Tools Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Assigned Tools:
                    </span>
                    {selectedAgent.enabledTools.length === 0 ? (
                      <span
                        className="font-mono-tech inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: "var(--badge-bg)",
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-muted)",
                        }}
                      >
                        <Wrench className="h-3 w-3 opacity-50" />
                        No tools assigned
                      </span>
                    ) : (
                      selectedAgent.enabledTools.map((tool) => (
                        <span
                          key={tool}
                          className="font-mono-tech inline-flex items-center gap-1 rounded-[4px] border px-2.5 py-0.5 text-xs font-semibold"
                          style={{
                            backgroundColor: "var(--badge-bg)",
                            borderColor: "var(--badge-border)",
                            color: "var(--badge-text)",
                          }}
                        >
                          <Wrench className="h-3 w-3 opacity-75" />
                          {tool}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  Select an agent above to begin conversations and inspect execution traces.
                </div>
              )}
            </Card>

            {/* Chat Prompt Box */}
            <Card className="rounded-[4px] p-5">
              <form onSubmit={handleRunPrompt} className="space-y-3">
                <FieldLabel className="mb-1 text-xs font-semibold uppercase tracking-wider">
                  Agent Prompt
                </FieldLabel>
                <div className="flex gap-2.5">
                  <Input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isRunning || !selectedAgentId}
                    placeholder={
                      selectedAgentId
                        ? "Ask something that uses tools or runbooks, e.g. Calculate (120 * 0.15) + 45"
                        : "Select or create an agent first..."
                    }
                    className="flex-1 rounded-[4px] px-4 py-2.5"
                  />
                  <Button
                    type="submit"
                    disabled={isRunning || !prompt.trim() || !selectedAgentId}
                    className="flex items-center gap-1.5 rounded-[4px] px-5 py-2.5 text-sm font-semibold tracking-tight"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {isRunning ? "Running..." : "Send"}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Executions History and Trace Inspector */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Executions List */}
              <Card className="rounded-[4px] p-5 lg:col-span-5">
                <div className="mb-3.5 flex items-center justify-between">
                  <h3
                    className="font-display text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Executions ({executions.length})
                  </h3>
                  <span
                    className="font-mono-tech text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    History
                  </span>
                </div>

                {executions.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    No executions recorded yet. Send a prompt to run this agent.
                  </p>
                ) : (
                  <ul className="max-h-[580px] space-y-2.5 overflow-y-auto pr-1">
                    {executions.map((exec) => {
                      const active = exec.id === selectedExecution?.id;
                      return (
                        <li key={exec.id} className="animate-fade-in">
                          <button
                            type="button"
                            onClick={() => setSelectedExecutionId(exec.id)}
                            className={`w-full rounded-[4px] p-3 text-left text-xs ${
                              active ? "af-item-card-active" : "af-item-card"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className="font-mono-tech inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider"
                                style={{ color: "var(--text-primary)" }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      exec.status === "failed"
                                        ? "var(--danger-text)"
                                        : "var(--text-primary)",
                                  }}
                                />
                                {exec.status}
                              </span>
                              <span
                                className="font-mono-tech text-[11px]"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {exec.trace.length} steps
                              </span>
                            </div>
                            <p
                              className="mt-1.5 line-clamp-2 text-xs leading-relaxed"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {exec.prompt}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              {/* Execution Trace & Citations */}
              <Card className="rounded-[4px] p-5 lg:col-span-7">
                <div className="mb-3.5 flex items-center justify-between">
                  <h3
                    className="font-display text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Execution Trace
                  </h3>
                  {selectedExecution && (
                    <span
                      className="font-mono-tech text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {selectedExecution.trace.length} steps logged
                    </span>
                  )}
                </div>

                {!selectedExecution ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Select an execution from history to inspect its trace steps and citations.
                  </p>
                ) : (
                  <div key={selectedExecution.id} className="animate-fade-in space-y-4">
                    {selectedExecution.response && (
                      <SurfaceInset className="rounded-[4px] p-3.5">
                        <div
                          className="font-display mb-1.5 text-[11px] font-semibold uppercase tracking-widest"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Final Response
                        </div>
                        <p
                          className="whitespace-pre-wrap text-sm leading-relaxed"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {selectedExecution.response}
                        </p>
                      </SurfaceInset>
                    )}

                    <ol className="max-h-[500px] space-y-2.5 overflow-y-auto pr-1">
                      {selectedExecution.trace.map((step, idx) => {
                        const citations = extractStepCitations(step);
                        return (
                          <li
                            key={`${selectedExecution.id}-${step.step}`}
                            style={{ animationDelay: `${idx * 45}ms` }}
                            className="af-surface-inset animate-fade-in-up rounded-[4px] p-3 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="font-mono-tech font-semibold"
                                style={{ color: "var(--text-primary)" }}
                              >
                                #{step.step} · {step.type}
                              </span>
                              <div className="flex items-center gap-2">
                                {step.durationMs !== undefined && (
                                  <span
                                    className="font-mono-tech rounded-[4px] border px-1.5 py-0.5 text-[10px]"
                                    style={{
                                      backgroundColor: "var(--badge-bg)",
                                      borderColor: "var(--badge-border)",
                                      color: "var(--text-secondary)",
                                    }}
                                  >
                                    {step.durationMs}ms
                                  </span>
                                )}
                                <span
                                  className="font-mono-tech text-[11px]"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  {new Date(step.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                            <p
                              className="mt-1.5 leading-relaxed"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {step.summary}
                            </p>
                            {citations.length > 0 && (
                              <div className="mt-2.5 space-y-1.5">
                                <div
                                  className="font-display text-[10px] font-semibold uppercase tracking-widest"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  Verifiable Citations ({citations.length})
                                </div>
                                <ul className="space-y-1.5">
                                  {citations.map((item, cIdx) => (
                                    <li
                                      key={`${step.step}-citation-${cIdx}`}
                                      className="rounded-[4px] border p-2"
                                      style={{
                                        backgroundColor: "var(--bg-secondary)",
                                        borderColor: "var(--border-subtle)",
                                      }}
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span
                                          className="font-mono-tech text-[11px] font-semibold"
                                          style={{ color: "var(--text-primary)" }}
                                        >
                                          {item.citation}
                                        </span>
                                        <span
                                          className="font-mono-tech rounded-[4px] border px-1.5 py-0.5 text-[10px]"
                                          style={{
                                            backgroundColor: "var(--badge-bg)",
                                            borderColor: "var(--badge-border)",
                                            color: "var(--badge-text)",
                                          }}
                                        >
                                          Score: {item.score.toFixed(2)}
                                        </span>
                                      </div>
                                      <p
                                        className="mt-1 text-[11px] leading-relaxed"
                                        style={{ color: "var(--text-secondary)" }}
                                      >
                                        {item.snippet}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {step.payload && (
                              <pre
                                className="font-mono-tech mt-2 overflow-x-auto rounded-[4px] border p-2.5 text-[11px]"
                                style={{
                                  backgroundColor: "var(--bg-secondary)",
                                  borderColor: "var(--border-subtle)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {JSON.stringify(step.payload, null, 2)}
                              </pre>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: AGENTS MANAGEMENT
        ========================================================================= */}
        {activeTab === "agents" && (
          <div className="space-y-6">
            <Card className="rounded-[4px] p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="flex items-center gap-2.5">
                  <Bot className="h-5 w-5" style={{ color: "var(--text-primary)" }} />
                  <div>
                    <h2
                      className="font-display text-sm font-semibold uppercase tracking-widest"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Configured Agents ({agents.length})
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Manage agent instructions, linked account documents, and assigned tools.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={openCreateForm}
                  className="rounded-[4px] px-3.5 py-2 text-xs font-semibold shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Agent</span>
                </Button>
              </div>

              {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-[4px] border mb-3"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <Bot className="h-6 w-6 opacity-60" />
                  </div>
                  <h3
                    className="font-display text-sm font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    No agents created yet
                  </h3>
                  <p
                    className="mt-1 max-w-sm text-xs leading-relaxed mb-4"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Get started by creating your first agent with custom prompts, model selection, and tool access.
                  </p>
                  <Button
                    onClick={openCreateForm}
                    className="rounded-[4px] px-4 py-2 text-xs font-semibold shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Your First Agent</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Real-time search filter for configured agents */}
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                      style={{ color: "var(--text-muted)" }}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={agentSearchQuery}
                      onChange={(e) => setAgentSearchQuery(e.target.value)}
                      placeholder="Filter agents by name, model, or description..."
                      className="af-input w-full rounded-[4px] py-1.5 pl-9 pr-8 text-xs"
                    />
                    {agentSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAgentSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-xs opacity-60 hover:opacity-100"
                        style={{ color: "var(--text-muted)" }}
                        aria-label="Clear filter"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {filteredConfiguredAgents.length === 0 ? (
                    <p className="py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      No agents match &quot;{agentSearchQuery}&quot;.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {filteredConfiguredAgents.map((agent) => {
                        return (
                          <div
                            key={agent.id}
                            className="af-surface-inset flex flex-col justify-between rounded-[4px] border p-4 transition-all"
                            style={{
                              borderColor: "var(--border-subtle)",
                            }}
                          >
                            <div>
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <h3
                                  className="font-display text-base font-bold"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {agent.name}
                                </h3>

                                <div className="flex items-center gap-1.5">
                                  <Button
                                    variant="secondary"
                                    onClick={() => openEditForm(agent)}
                                    className="rounded-[4px] px-2.5 py-1 text-xs font-medium"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    <span>Edit</span>
                                  </Button>
                                  <Button
                                    variant="danger"
                                    onClick={() => setAgentToDelete(agent)}
                                    className="rounded-[4px] px-2.5 py-1 text-xs font-medium"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>Delete</span>
                                  </Button>
                                </div>
                              </div>

                              <p
                                className="mt-1.5 text-xs leading-relaxed"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {agent.description || "No description provided."}
                              </p>
                            </div>

                            {/* Agent Properties Badges */}
                            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
                              {/* Model Badge */}
                              <span
                                className="font-mono-tech inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-xs font-medium"
                                style={{
                                  backgroundColor: "var(--badge-bg)",
                                  borderColor: "var(--badge-border)",
                                  color: "var(--badge-text)",
                                }}
                              >
                                <Cpu className="h-3 w-3 opacity-75" />
                                {agent.provider} / {agent.model}
                              </span>

                              {/* Linked Documents Count Badge */}
                              <span
                                className="font-mono-tech inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-xs font-medium"
                                style={{
                                  backgroundColor: "var(--badge-bg)",
                                  borderColor: "var(--badge-border)",
                                  color: "var(--badge-text)",
                                }}
                              >
                                <FileText className="h-3 w-3 opacity-75" />
                                {(agent.documentIds ?? []).length}{" "}
                                {(agent.documentIds ?? []).length === 1
                                  ? "Linked Document"
                                  : "Linked Documents"}
                              </span>

                              {/* Tools Badges */}
                              <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                                {agent.enabledTools.length === 0 ? (
                                  <span
                                    className="font-mono-tech inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-xs font-medium"
                                    style={{
                                      backgroundColor: "var(--badge-bg)",
                                      borderColor: "var(--border-subtle)",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    No tools assigned
                                  </span>
                                ) : (
                                  agent.enabledTools.map((tool) => (
                                    <span
                                      key={tool}
                                      className="font-mono-tech inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-xs font-medium"
                                      style={{
                                        backgroundColor: "var(--badge-bg)",
                                        borderColor: "var(--badge-border)",
                                        color: "var(--badge-text)",
                                      }}
                                    >
                                      <Wrench className="h-2.5 w-2.5 opacity-70" />
                                      {tool}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* =========================================================================
            TAB 3: ACCOUNT DOCUMENTS
        ========================================================================= */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            <DocumentsPanel
              documents={documents}
              onDocumentUploaded={handleDocumentUploaded}
              onRequestDeleteDocument={(doc) => setDocumentToDelete(doc)}
            />
          </div>
        )}
      </main>

      {/* Modal: Create Agent */}
      <AgentFormModal
        isOpen={isCreatingAgent}
        mode="create"
        onClose={() => {
          if (!isCreating) setIsCreatingAgent(false);
        }}
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        provider={provider}
        onProviderChange={handleCreateProviderChange}
        model={model}
        setModel={setModel}
        enabledTools={enabledTools}
        onToggleTool={toggleCreateTool}
        selectedDocumentIds={createDocumentIds}
        onToggleDocument={toggleCreateDocument}
        availableProviders={availableProviders}
        modelsForProvider={createModelsForProvider}
        availableTools={AVAILABLE_TOOLS}
        documents={documents}
        isSubmitting={isCreating}
        onSubmit={handleCreateAgent}
      />

      {/* Modal: Edit Agent */}
      <AgentFormModal
        isOpen={isEditing}
        mode="edit"
        onClose={() => {
          if (!isSavingEdit) {
            setIsEditing(false);
            setEditingAgentId(null);
          }
        }}
        name={editName}
        setName={setEditName}
        description={editDescription}
        setDescription={setEditDescription}
        systemPrompt={editSystemPrompt}
        setSystemPrompt={setEditSystemPrompt}
        provider={editProvider}
        onProviderChange={handleEditProviderChange}
        model={editModel}
        setModel={setEditModel}
        enabledTools={editTools}
        onToggleTool={toggleEditTool}
        selectedDocumentIds={editDocumentIds}
        onToggleDocument={toggleEditDocument}
        availableProviders={availableProviders}
        modelsForProvider={editModelsForProvider}
        availableTools={AVAILABLE_TOOLS}
        documents={documents}
        isSubmitting={isSavingEdit}
        onSubmit={handleSaveEdit}
      />

      {/* Confirmation Modal: Delete Agent */}
      <ConfirmationModal
        isOpen={Boolean(agentToDelete)}
        title="Delete Agent"
        description="Are you sure you want to delete this agent? All execution history associated with this agent will remain in storage, but the agent configuration will be permanently removed."
        targetName={agentToDelete?.name ?? ""}
        confirmLabel="Delete Agent"
        cancelLabel="Cancel"
        isProcessing={isConfirmingDelete}
        onConfirm={() => void handleConfirmDeleteAgent()}
        onCancel={() => {
          if (!isConfirmingDelete) setAgentToDelete(null);
        }}
      />

      {/* Confirmation Modal: Delete Document */}
      <ConfirmationModal
        isOpen={Boolean(documentToDelete)}
        title="Delete Document"
        description="Are you sure you want to remove this document from your account? It will be detached from any linked agents and its indexed chunks will be deleted."
        targetName={documentToDelete ? `${documentToDelete.title} (${documentToDelete.fileName})` : ""}
        confirmLabel="Delete Document"
        cancelLabel="Cancel"
        isProcessing={isConfirmingDelete}
        onConfirm={() => void handleConfirmDeleteDocument()}
        onCancel={() => {
          if (!isConfirmingDelete) setDocumentToDelete(null);
        }}
      />

      {/* Modal: Switch Active Agent with Search Filter */}
      <SelectActiveAgentModal
        isOpen={isSelectAgentModalOpen}
        onClose={() => setIsSelectAgentModalOpen(false)}
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={(agentId) => setSelectedAgentId(agentId)}
        onCreateNew={openCreateForm}
      />
    </div>
  );
}
