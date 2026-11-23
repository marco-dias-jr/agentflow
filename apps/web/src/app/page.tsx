"use client";

import { BrainCircuit, Check, Info, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import {
  AgentDTO,
  createAgent,
  deleteAgent,
  executeAgentPrompt,
  ExecutionDTO,
  getMe,
  listAgents,
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

export default function AgentFlowPage() {
  const [currentUser, setCurrentUser] = useState<UserProfileDTO | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
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

  // Edit selected agent state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [editProvider, setEditProvider] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editTools, setEditTools] = useState<string[]>([]);
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
        err instanceof Error ? err.message : "Unable to load models."
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
        err instanceof Error ? err.message : "Unable to load agents."
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
        err instanceof Error ? err.message : "Unable to load execution history."
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
      });
      setName("");
      setDescription("");
      await refreshAgents(created.id);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to create agent."
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
      });
      setIsEditing(false);
      await refreshAgents(updated.id);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update agent."
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
        err instanceof Error ? err.message : "Failed to delete agent."
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
        err instanceof Error ? err.message : "Failed to run agent."
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
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border font-display text-sm font-bold tracking-tighter shadow-sm transition-all duration-300"
                style={{
                  backgroundColor: "var(--accent-bg)",
                  color: "var(--accent-text)",
                  borderColor: "var(--border-default)",
                }}
              >
                <BrainCircuit className="h-5 w-5" aria-hidden="true" />
              </div>
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
            className="af-surface-inset flex items-center gap-3 rounded-full py-1 pl-3.5 pr-1.5"
          >
            <div className="text-right text-xs leading-tight">
              <div
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {currentUser.fullName}
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
        <div
          className="animate-slide-reveal mb-6 flex items-center justify-between rounded-none border px-4 py-3 text-sm"
          style={{
            backgroundColor: "var(--danger-bg)",
            borderColor: "var(--danger-border)",
            color: "var(--danger-text)",
          }}
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="ml-4 text-xs font-semibold uppercase tracking-wider opacity-75 transition-opacity hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Agents list + Create Agent */}
        <section
          className="animate-fade-in-up space-y-6 lg:col-span-4"
          style={{ animationDelay: "60ms" }}
        >
          <div className="af-card rounded-none p-5">
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
                        className={`w-full rounded-none px-3.5 py-3 text-left ${
                          active ? "af-item-card-active" : "af-item-card"
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
          </div>

          <form
            onSubmit={handleCreateAgent}
            className="af-card space-y-3.5 rounded-none p-5"
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
              <label
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Support Assistant"
                className="af-input w-full rounded-none px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Handles operational troubleshooting and calculations"
                className="af-input w-full rounded-none px-3.5 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => handleCreateProviderChange(e.target.value)}
                  disabled={availableProviders.length === 0}
                  className="af-input w-full rounded-none px-3.5 py-2 text-sm disabled:opacity-50"
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
                </select>
              </div>

              <div>
                <label
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={createModelsForProvider.length === 0}
                  className="af-input w-full rounded-none px-3.5 py-2 text-sm disabled:opacity-50"
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
                </select>
              </div>
            </div>

            <div>
              <label
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                System Prompt
              </label>
              <textarea
                rows={3}
                required
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="af-input w-full rounded-none px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <span
                className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Tools
                <span
                  title="Click tags to enable or disable tools for this agent"
                  className="inline-flex cursor-help items-center opacity-75 hover:opacity-100"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </span>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TOOLS.map((tool) => {
                  const checked = enabledTools.includes(tool.id);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => toggleCreateTool(tool.id)}
                      className="flex items-center gap-1.5 rounded-none border px-3 py-1.5 text-xs font-medium transition-all duration-200"
                      style={
                        checked
                          ? {
                              backgroundColor: "var(--badge-active-bg)",
                              borderColor: "var(--badge-active-border)",
                              color: "var(--badge-active-text)",
                            }
                          : {
                              backgroundColor: "var(--bg-tertiary)",
                              borderColor: "var(--border-default)",
                              color: "var(--text-secondary)",
                            }
                      }
                    >
                      {checked ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <X className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                      )}
                      {tool.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreating || models.length === 0}
              className="af-btn-primary w-full rounded-none px-4 py-2.5 text-sm font-semibold tracking-tight disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create Agent"}
            </button>
          </form>
        </section>

        {/* Right Column: Selected Agent + Edit/Delete + Conversation + Trace */}
        <section
          className="animate-fade-in-up space-y-6 lg:col-span-8"
          style={{ animationDelay: "120ms" }}
        >
          <div className="af-card rounded-none p-5">
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

                    <button
                      type="button"
                      onClick={() =>
                        isEditing
                          ? setIsEditing(false)
                          : openEditForm(selectedAgent)
                      }
                      className="af-btn-secondary rounded-none px-3 py-1.5 text-xs font-medium"
                    >
                      {isEditing ? "Cancel Edit" : "Edit Agent"}
                    </button>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => void handleDeleteAgent(selectedAgent)}
                      className="rounded-none border px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                      style={{
                        backgroundColor: "var(--danger-bg)",
                        borderColor: "var(--danger-border)",
                        color: "var(--danger-text)",
                      }}
                    >
                      {isDeleting ? "Deleting..." : "Delete Agent"}
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <form
                    onSubmit={handleSaveEdit}
                    className="af-surface-inset animate-slide-reveal mb-5 space-y-3.5 rounded-none p-4"
                  >
                    <h3
                      className="font-display text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Edit Agent Configuration
                    </h3>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label
                          className="mb-1 block text-xs font-medium"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Name
                        </label>
                        <input
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="af-input w-full rounded-none px-3 py-1.5 text-sm"
                        />
                      </div>

                      <div>
                        <label
                          className="mb-1 block text-xs font-medium"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Provider
                        </label>
                        <select
                          value={editProvider}
                          onChange={(e) =>
                            handleEditProviderChange(e.target.value)
                          }
                          className="af-input w-full rounded-none px-3 py-1.5 text-sm"
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
                        </select>
                      </div>

                      <div>
                        <label
                          className="mb-1 block text-xs font-medium"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Model
                        </label>
                        <select
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          className="af-input w-full rounded-none px-3 py-1.5 text-sm"
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
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Description
                      </label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="af-input w-full rounded-none px-3 py-1.5 text-sm"
                      />
                    </div>

                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        System Prompt
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={editSystemPrompt}
                        onChange={(e) => setEditSystemPrompt(e.target.value)}
                        className="af-input w-full rounded-none px-3 py-1.5 text-sm"
                      />
                    </div>

                    <div>
                      <span
                        className="mb-1 flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Active Tools
                        <span
                          title="Click tags to enable or disable tools for this agent"
                          className="inline-flex cursor-help items-center opacity-75 hover:opacity-100"
                        >
                          <Info className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_TOOLS.map((tool) => {
                          const checked = editTools.includes(tool.id);
                          return (
                            <button
                              key={`edit-tool-${tool.id}`}
                              type="button"
                              onClick={() => toggleEditTool(tool.id)}
                              className="flex items-center gap-1.5 rounded-none border px-3 py-1 text-xs font-medium transition-all duration-200"
                              style={
                                checked
                                  ? {
                                      backgroundColor: "var(--badge-active-bg)",
                                      borderColor: "var(--badge-active-border)",
                                      color: "var(--badge-active-text)",
                                    }
                                  : {
                                      backgroundColor: "var(--bg-secondary)",
                                      borderColor: "var(--border-default)",
                                      color: "var(--text-secondary)",
                                    }
                              }
                            >
                              {checked ? (
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <X className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                              )}
                              {tool.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isSavingEdit}
                        className="af-btn-primary rounded-none px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        {isSavingEdit ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                )}

                <form onSubmit={handleRunPrompt} className="flex gap-2.5">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask something that uses tools or runbooks, e.g. Calculate (120 * 0.15) + 45"
                    className="af-input flex-1 rounded-none px-4 py-2.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isRunning || !prompt.trim()}
                    className="af-btn-primary rounded-none px-5 py-2.5 text-sm font-semibold tracking-tight disabled:opacity-50"
                  >
                    {isRunning ? "Running..." : "Send"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Execution History & Trace Inspector */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="af-card rounded-none p-5 md:col-span-5">
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
                          className={`w-full rounded-none p-3 text-left text-xs ${
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
            </div>

            <div className="af-card rounded-none p-5 md:col-span-7">
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
                    <div className="af-surface-inset rounded-none p-3.5">
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
                    </div>
                  )}

                  <ol className="space-y-2.5">
                    {selectedExecution.trace.map((step, idx) => (
                      <li
                        key={`${selectedExecution.id}-${step.step}`}
                        style={{ animationDelay: `${idx * 45}ms` }}
                        className="af-surface-inset animate-fade-in-up rounded-none p-3 text-xs"
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
                            className="font-mono-tech mt-2 overflow-x-auto rounded-none border p-2.5 text-[11px]"
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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
