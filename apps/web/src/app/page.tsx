"use client";

import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card, SurfaceInset } from "@/components/ui/Card";
import { DocumentSelector } from "@/components/ui/DocumentSelector";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/Input";
import { ToolSelector } from "@/components/ui/ToolSelector";
import {
  AgentDTO,
  createAgent,
  deleteAgent,
  DocumentDTO,
  executeAgentPrompt,
  ExecutionDTO,
  getMe,
  getUserFriendlyError,
  listAgents,
  listDocuments,
  listExecutions,
  listModels,
  logoutAccount,
  ModelOptionDTO,
  updateAgent,
  UserProfileDTO,
} from "@/lib/api";

const AVAILABLE_TOOLS = [
  { id: "calculator", label: "Calculator" },
  { id: "knowledge_search", label: "Knowledge Search" },
];

function formatShortName(fullName?: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] || "";
}

export default function AgentFlowPage() {
  const [currentUser, setCurrentUser] = useState<UserProfileDTO | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [models, setModels] = useState<ModelOptionDTO[]>([]);
  const [executions, setExecutions] = useState<ExecutionDTO[]>([]);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string>("");

  // Create agent form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful operational assistant. Use available tools when accurate calculations or runbooks are needed."
  );
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [enabledTools, setEnabledTools] = useState<string[]>([
    "calculator",
    "knowledge_search",
  ]);
  const [createDocumentIds, setCreateDocumentIds] = useState<string[]>([]);

  // Edit selected agent state
  const [isEditing, setIsEditing] = useState(false);
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

  const selectedExecution =
    executions.find((exec) => exec.id === selectedExecutionId) ??
    executions[0] ??
    null;

  const availableProviders = Array.from(
    new Map(models.map((m) => [m.provider, m.providerLabel])).entries()
  ).map(([id, label]) => ({ id, label }));

  const createModelsForProvider = models.filter((m) => m.provider === provider);
  const editModelsForProvider = models.filter(
    (m) => m.provider === editProvider
  );

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

  function openEditForm(agent: AgentDTO) {
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
      setCreateDocumentIds([]);
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
    if (!selectedAgent) return;
    setErrorMessage(null);
    setIsSavingEdit(true);
    try {
      const updated = await updateAgent(selectedAgent.id, {
        name: editName,
        description: editDescription,
        systemPrompt: editSystemPrompt,
        provider: editProvider,
        model: editModel,
        enabledTools: editTools,
        documentIds: editDocumentIds,
      });
      setIsEditing(false);
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

  async function handleDeleteAgent(agent: AgentDTO) {
    setErrorMessage(null);
    setIsDeleting(true);
    try {
      await deleteAgent(agent.id);
      const remaining = agents.filter((item) => item.id !== agent.id);
      setAgents(remaining);
      if (selectedAgentId === agent.id) {
        setSelectedAgentId(remaining[0]?.id ?? "");
      }
    } catch (err) {
      setErrorMessage(
        getUserFriendlyError(
          err,
          "We couldn't delete this agent right now. Please try again in a moment."
        )
      );
    } finally {
      setIsDeleting(false);
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
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header
        className="animate-fade-in-up mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-5"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center gap-3">
              <BrandMark />
              <h1
                className="font-display text-2xl font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                AgentFlow
              </h1>
            </div>
            <span
              className="font-mono-tech rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest"
              style={{
                backgroundColor: "var(--badge-bg)",
                borderColor: "var(--badge-border)",
                color: "var(--text-secondary)",
              }}
            >
              AI Agent Platform
            </span>
          </div>
          <p
            className="mt-0.5 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Configure agents, switch models, edit tools, and inspect execution traces.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Theme Switcher */}
          <ThemeSwitcher
            theme={theme}
            onToggleTheme={(nextTheme) => toggleTheme(nextTheme)}
          />

          <div
            className="flex items-center gap-3 py-1 pl-3.5 pr-1.5"
          >
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
              className="af-btn-secondary rounded-full px-3 py-1 text-xs font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {errorMessage && (
        <AlertBanner
          variant="error"
          className="mb-6 px-4 py-3 text-sm"
          onDismiss={() => setErrorMessage(null)}
        >
          {errorMessage}
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Agents list + Create Agent */}
        <section
          className="animate-fade-in-up space-y-6 lg:col-span-4"
          style={{ animationDelay: "60ms" }}
        >
          <Card className="p-5">
            <div className="mb-3.5 flex items-center justify-between">
              <h2
                className="font-display text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--text-secondary)" }}
              >
                Agents ({agents.length})
              </h2>
              <span
                className="font-mono-tech text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                Directory
              </span>
            </div>
            {agents.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No agents created yet. Create one below.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {agents.map((agent) => {
                  const active = agent.id === selectedAgentId;
                  return (
                    <li key={agent.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={`w-full rounded-[3px] px-3.5 py-3 text-left ${active ? "af-item-card-active" : "af-item-card"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-semibold">
                            {agent.name}
                          </span>
                          {active && (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: "var(--text-primary)" }}
                            />
                          )}
                        </div>
                        <div
                          className="font-mono-tech mt-1 text-xs"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {agent.provider} · {agent.model}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <form
            onSubmit={handleCreateAgent}
            className="af-card space-y-3.5 rounded-[3px] p-5"
          >
            <div className="flex items-center justify-between">
              <h2
                className="font-display text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--text-secondary)" }}
              >
                Create Agent
              </h2>
              <span
                className="font-mono-tech text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                New Instance
              </span>
            </div>

            <div>
              <FieldLabel className="mb-1.5">Name</FieldLabel>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Support Assistant"
                className="px-3.5 py-2"
              />
            </div>

            <div>
              <FieldLabel className="mb-1.5">Description</FieldLabel>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Handles operational troubleshooting and calculations"
                className="px-3.5 py-2"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel className="mb-1.5">Provider</FieldLabel>
                <Select
                  value={provider}
                  onChange={(e) => handleCreateProviderChange(e.target.value)}
                  disabled={availableProviders.length === 0}
                  className="px-3.5 py-2"
                >
                  {availableProviders.length === 0 ? (
                    <option value="">No providers in .env</option>
                  ) : (
                    availableProviders.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.label}
                      </option>
                    ))
                  )}
                </Select>
              </div>

              <div>
                <FieldLabel className="mb-1.5">Model</FieldLabel>
                <Select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={createModelsForProvider.length === 0}
                  className="px-3.5 py-2"
                >
                  {createModelsForProvider.length === 0 ? (
                    <option value="">No models configured</option>
                  ) : (
                    createModelsForProvider.map((opt) => (
                      <option key={`${opt.provider}-${opt.id}`} value={opt.id}>
                        {opt.label}
                      </option>
                    ))
                  )}
                </Select>
              </div>
            </div>

            <div>
              <FieldLabel className="mb-1.5">System Prompt</FieldLabel>
              <Textarea
                rows={3}
                required
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="px-3.5 py-2"
              />
            </div>

            <ToolSelector
              label="Tools"
              tools={AVAILABLE_TOOLS}
              selectedTools={enabledTools}
              onToggle={toggleCreateTool}
            />

            <DocumentSelector
              label="Account Documents"
              documents={documents}
              selectedDocumentIds={createDocumentIds}
              onToggle={toggleCreateDocument}
              keyPrefix="create-doc-"
            />

            <Button
              type="submit"
              disabled={isCreating || models.length === 0}
              className="w-full px-4 py-2.5 text-sm font-semibold tracking-tight"
            >
              {isCreating ? "Creating..." : "Create Agent"}
            </Button>
          </form>

          <DocumentsPanel
            documents={documents}
            onDocumentUploaded={handleDocumentUploaded}
          />
        </section>

        {/* Right Column: Selected Agent + Edit/Delete + Conversation + Trace */}
        <section
          className="animate-fade-in-up space-y-6 lg:col-span-8"
          style={{ animationDelay: "120ms" }}
        >
          <Card className="p-5">
            {!selectedAgent ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Select or create an agent to start a conversation.
              </p>
            ) : (
              <div key={selectedAgent.id} className="animate-fade-in">
                <div
                  className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-4"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div>
                    <h2
                      className="font-display text-lg font-bold tracking-tight"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {selectedAgent.name}
                    </h2>
                    <p
                      className="mt-0.5 text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {selectedAgent.description || "No description"} ·{" "}
                      <span
                        className="font-mono-tech font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {selectedAgent.provider} / {selectedAgent.model}
                      </span>
                      {" · "}
                      <span
                        className="font-mono-tech"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {(selectedAgent.documentIds ?? []).length}{" "}
                        {(selectedAgent.documentIds ?? []).length === 1
                          ? "doc"
                          : "docs"}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1.5">
                      {selectedAgent.enabledTools.length === 0 ? (
                        <span
                          className="font-mono-tech rounded-md border px-2.5 py-0.5 text-xs"
                          style={{
                            backgroundColor: "var(--badge-bg)",
                            borderColor: "var(--border-subtle)",
                            color: "var(--text-muted)",
                          }}
                        >
                          No tools
                        </span>
                      ) : (
                        selectedAgent.enabledTools.map((t) => (
                          <span
                            key={t}
                            className="font-mono-tech rounded-md border px-2.5 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: "var(--badge-bg)",
                              borderColor: "var(--badge-border)",
                              color: "var(--badge-text)",
                            }}
                          >
                            {t}
                          </span>
                        ))
                      )}
                    </div>

                    <Button
                      variant="secondary"
                      onClick={() =>
                        isEditing
                          ? setIsEditing(false)
                          : openEditForm(selectedAgent)
                      }
                      className="px-3 py-1.5 text-xs font-medium"
                    >
                      {isEditing ? "Cancel Edit" : "Edit Agent"}
                    </Button>

                    <Button
                      variant="danger"
                      disabled={isDeleting}
                      onClick={() => void handleDeleteAgent(selectedAgent)}
                      className="px-3 py-1.5 text-xs font-medium"
                    >
                      {isDeleting ? "Deleting..." : "Delete Agent"}
                    </Button>
                  </div>
                </div>

                {isEditing && (
                  <form
                    onSubmit={handleSaveEdit}
                    className="af-surface-inset animate-slide-reveal mb-5 space-y-3.5 rounded-[3px] p-4"
                  >
                    <h3
                      className="font-display text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Edit Agent Configuration
                    </h3>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <FieldLabel>Name</FieldLabel>
                        <Input
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-3 py-1.5"
                        />
                      </div>

                      <div>
                        <FieldLabel>Provider</FieldLabel>
                        <Select
                          value={editProvider}
                          onChange={(e) =>
                            handleEditProviderChange(e.target.value)
                          }
                          className="px-3 py-1.5"
                        >
                          {!availableProviders.some(
                            (p) => p.id === editProvider
                          ) && (
                              <option value={editProvider}>
                                {editProvider} (Current)
                              </option>
                            )}
                          {availableProviders.map((prov) => (
                            <option key={`edit-prov-${prov.id}`} value={prov.id}>
                              {prov.label}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <FieldLabel>Model</FieldLabel>
                        <Select
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          className="px-3 py-1.5"
                        >
                          {!editModelsForProvider.some(
                            (m) => m.id === editModel
                          ) && (
                              <option value={editModel}>
                                {editModel} (Current)
                              </option>
                            )}
                          {editModelsForProvider.map((opt) => (
                            <option
                              key={`edit-${opt.provider}-${opt.id}`}
                              value={opt.id}
                            >
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    <div>
                      <FieldLabel>Description</FieldLabel>
                      <Input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="px-3 py-1.5"
                      />
                    </div>

                    <div>
                      <FieldLabel>System Prompt</FieldLabel>
                      <Textarea
                        rows={3}
                        required
                        value={editSystemPrompt}
                        onChange={(e) => setEditSystemPrompt(e.target.value)}
                        className="px-3 py-1.5"
                      />
                    </div>

                    <ToolSelector
                      label="Active Tools"
                      tools={AVAILABLE_TOOLS}
                      selectedTools={editTools}
                      onToggle={toggleEditTool}
                      keyPrefix="edit-tool-"
                      inactiveSurface="secondary"
                      compact
                    />

                    <DocumentSelector
                      label="Linked Documents"
                      documents={documents}
                      selectedDocumentIds={editDocumentIds}
                      onToggle={toggleEditDocument}
                      keyPrefix="edit-doc-"
                      inactiveSurface="secondary"
                      compact
                    />

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="submit"
                        disabled={isSavingEdit}
                        className="px-4 py-1.5 text-xs font-semibold"
                      >
                        {isSavingEdit ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                )}

                <form onSubmit={handleRunPrompt} className="flex gap-2.5">
                  <Input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isRunning}
                    placeholder="Ask something that uses tools or runbooks, e.g. Calculate (120 * 0.15) + 45"
                    className="flex-1 px-4 py-2.5"
                  />
                  <Button
                    type="submit"
                    disabled={isRunning || !prompt.trim()}
                    className="px-5 py-2.5 text-sm font-semibold tracking-tight"
                  >
                    {isRunning ? "Running..." : "Send"}
                  </Button>
                </form>
              </div>
            )}
          </Card>

          {/* Execution History & Trace Inspector */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <Card className="p-5 md:col-span-5">
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
                  No executions recorded yet.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {executions.map((exec) => {
                    const active = exec.id === selectedExecution?.id;
                    return (
                      <li key={exec.id} className="animate-fade-in">
                        <button
                          type="button"
                          onClick={() => setSelectedExecutionId(exec.id)}
                          className={`w-full rounded-[3px] p-3 text-left text-xs ${active ? "af-item-card-active" : "af-item-card"
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

            <Card className="p-5 md:col-span-7">
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
                  Select an execution to inspect its trace steps.
                </p>
              ) : (
                <div
                  key={selectedExecution.id}
                  className="animate-fade-in space-y-4"
                >
                  {selectedExecution.response && (
                    <SurfaceInset className="p-3.5">
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

                  <ol className="space-y-2.5">
                    {selectedExecution.trace.map((step, idx) => (
                      <li
                        key={`${selectedExecution.id}-${step.step}`}
                        style={{ animationDelay: `${idx * 45}ms` }}
                        className="af-surface-inset animate-fade-in-up rounded-[3px] p-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="font-mono-tech font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            #{step.step} · {step.type}
                          </span>
                          <span
                            className="font-mono-tech text-[11px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {new Date(step.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p
                          className="mt-1.5 leading-relaxed"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {step.summary}
                        </p>
                        {step.payload && (
                          <pre
                            className="font-mono-tech mt-2 overflow-x-auto rounded-[3px] border p-2.5 text-[11px]"
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
                    ))}
                  </ol>
                </div>
              )}
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
