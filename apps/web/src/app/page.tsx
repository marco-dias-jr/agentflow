"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AgentDTO,
  createAgent,
  deleteAgent,
  executeAgentPrompt,
  ExecutionDTO,
  listAgents,
  listExecutions,
  listModels,
  ModelOptionDTO,
  updateAgent,
} from "@/lib/api";

const AVAILABLE_TOOLS = [
  { id: "calculator", label: "Calculator" },
  { id: "knowledge_search", label: "Knowledge Search" },
];

export default function AgentFlowPage() {
  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [models, setModels] = useState<ModelOptionDTO[]>([]);
  const [activeProvider, setActiveProvider] = useState<string>("");
  const [executions, setExecutions] = useState<ExecutionDTO[]>([]);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string>("");

  // Create agent form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful operational assistant. Use available tools when accurate calculations or runbooks are needed."
  );
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

  async function refreshModels() {
    try {
      const data = await listModels();
      setActiveProvider(data.activeProvider);
      setModels(data.models);
      if (data.models.length > 0) {
        const preferred =
          data.models.find((m) => m.provider === data.activeProvider) ??
          data.models[0];
        setModel((prev) =>
          data.models.some((m) => m.id === prev) ? prev : preferred.id
        );
      } else {
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
    void refreshModels();
    void refreshAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setIsEditing(false);
    if (selectedAgentId) {
      void refreshExecutions(selectedAgentId);
    } else {
      setExecutions([]);
      setSelectedExecutionId("");
    }
  }, [selectedAgentId]);

  function openEditForm(agent: AgentDTO) {
    setEditName(agent.name);
    setEditDescription(agent.description);
    setEditSystemPrompt(agent.systemPrompt);
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
    if (!model) {
      setErrorMessage("Configure at least one model in your environment (.env).");
      return;
    }
    setErrorMessage(null);
    setIsCreating(true);
    try {
      const created = await createAgent({
        name,
        description,
        systemPrompt,
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header
        className="animate-fade-in-up mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-5"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl border font-display text-sm font-bold tracking-tighter shadow-sm transition-all duration-300"
            style={{
              backgroundColor: "var(--accent-bg)",
              color: "var(--accent-text)",
              borderColor: "var(--border-default)",
            }}
          >
            AF
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1
                className="font-display text-2xl font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                AgentFlow
              </h1>
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
              className="mt-1 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Configure agents, switch models, edit tools, and inspect execution traces.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className="af-surface-inset inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            <span
              className="animate-pulse-dot h-2 w-2 rounded-full"
              style={{
                backgroundColor: activeProvider
                  ? "var(--text-primary)"
                  : "var(--text-muted)",
              }}
            />
            <span>Active Provider:</span>
            <strong
              className="font-mono-tech font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-primary)" }}
            >
              {activeProvider || "not set"}
            </strong>
          </span>

          {/* Theme Switcher: Black UI / White UI */}
          <div
            className="af-surface-inset inline-flex items-center rounded-full p-1"
            role="group"
            aria-label="Color theme switcher"
          >
            <button
              type="button"
              onClick={() => toggleTheme("dark")}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-300"
              style={
                theme === "dark"
                  ? {
                      backgroundColor: "var(--accent-bg)",
                      color: "var(--accent-text)",
                    }
                  : {
                      color: "var(--text-secondary)",
                    }
              }
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
              <span>Black</span>
            </button>
            <button
              type="button"
              onClick={() => toggleTheme("light")}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-300"
              style={
                theme === "light"
                  ? {
                      backgroundColor: "var(--accent-bg)",
                      color: "var(--accent-text)",
                    }
                  : {
                      color: "var(--text-secondary)",
                    }
              }
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
              <span>White</span>
            </button>
          </div>
        </div>
      </header>

      {errorMessage && (
        <div
          className="animate-slide-reveal mb-6 flex items-center justify-between rounded-xl border px-4 py-3 text-sm"
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
          <div className="af-card rounded-2xl p-5">
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
                        className={`w-full rounded-xl px-3.5 py-3 text-left ${
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
                          Model: {agent.model}
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
            className="af-card space-y-3.5 rounded-2xl p-5"
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
                className="af-input w-full rounded-xl px-3.5 py-2 text-sm"
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
                className="af-input w-full rounded-xl px-3.5 py-2 text-sm"
              />
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
                disabled={models.length === 0}
                className="af-input w-full rounded-xl px-3.5 py-2 text-sm disabled:opacity-50"
              >
                {models.length === 0 ? (
                  <option value="">No models configured in .env</option>
                ) : (
                  models.map((opt) => (
                    <option key={`${opt.provider}-${opt.id}`} value={opt.id}>
                      {opt.label}
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
                System Prompt
              </label>
              <textarea
                rows={3}
                required
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="af-input w-full rounded-xl px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <span
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Tools
              </span>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TOOLS.map((tool) => {
                  const checked = enabledTools.includes(tool.id);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => toggleCreateTool(tool.id)}
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200"
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
                      {tool.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreating || models.length === 0}
              className="af-btn-primary w-full rounded-xl px-4 py-2.5 text-sm font-semibold tracking-tight disabled:opacity-50"
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
          <div className="af-card rounded-2xl p-5">
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
                        {selectedAgent.model}
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
                      className="af-btn-secondary rounded-xl px-3 py-1.5 text-xs font-medium"
                    >
                      {isEditing ? "Cancel Edit" : "Edit Agent"}
                    </button>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => void handleDeleteAgent(selectedAgent)}
                      className="rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50"
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
                    className="af-surface-inset animate-slide-reveal mb-5 space-y-3.5 rounded-xl p-4"
                  >
                    <h3
                      className="font-display text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Edit Agent Configuration
                    </h3>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                          className="af-input w-full rounded-xl px-3 py-1.5 text-sm"
                        />
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
                          className="af-input w-full rounded-xl px-3 py-1.5 text-sm"
                        >
                          {!models.some((m) => m.id === editModel) && (
                            <option value={editModel}>
                              {editModel} (Current)
                            </option>
                          )}
                          {models.map((opt) => (
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
                        className="af-input w-full rounded-xl px-3 py-1.5 text-sm"
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
                        className="af-input w-full rounded-xl px-3 py-1.5 text-sm"
                      />
                    </div>

                    <div>
                      <span
                        className="mb-1 block text-xs font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Active Tools
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_TOOLS.map((tool) => {
                          const checked = editTools.includes(tool.id);
                          return (
                            <button
                              key={`edit-tool-${tool.id}`}
                              type="button"
                              onClick={() => toggleEditTool(tool.id)}
                              className="rounded-lg border px-3 py-1 text-xs font-medium transition-all duration-200"
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
                        className="af-btn-primary rounded-xl px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
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
                    className="af-input flex-1 rounded-xl px-4 py-2.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isRunning || !prompt.trim()}
                    className="af-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold tracking-tight disabled:opacity-50"
                  >
                    {isRunning ? "Running..." : "Send"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Execution History & Trace Inspector */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="af-card rounded-2xl p-5 md:col-span-5">
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
                          className={`w-full rounded-xl p-3 text-left text-xs ${
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

            <div className="af-card rounded-2xl p-5 md:col-span-7">
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
                    <div className="af-surface-inset rounded-xl p-3.5">
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
                        className="af-surface-inset animate-fade-in-up rounded-xl p-3 text-xs"
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
                            className="font-mono-tech mt-2 overflow-x-auto rounded-lg border p-2.5 text-[11px]"
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
