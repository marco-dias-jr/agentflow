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
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            AgentFlow — AI Agent Platform
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Configure agents, switch models, edit tools, and inspect execution traces.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
          Active Provider:{" "}
          <strong className="text-sky-400">{activeProvider || "not set"}</strong>
        </span>
      </header>

      {errorMessage && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Agents list + Create Agent */}
        <section className="space-y-6 lg:col-span-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
              Agents ({agents.length})
            </h2>
            {agents.length === 0 ? (
              <p className="text-sm text-slate-500">
                No agents created yet. Create one below.
              </p>
            ) : (
              <ul className="space-y-2">
                {agents.map((agent) => {
                  const active = agent.id === selectedAgentId;
                  return (
                    <li key={agent.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                          active
                            ? "border-sky-500 bg-sky-950/40 text-white"
                            : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="font-medium">{agent.name}</div>
                        <div className="mt-0.5 text-xs text-slate-400">
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
            className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Create Agent
            </h2>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Support Assistant"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Handles operational troubleshooting and calculations"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={models.length === 0}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none disabled:opacity-50"
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
              <label className="mb-1 block text-xs text-slate-400">
                System Prompt
              </label>
              <textarea
                rows={3}
                required
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <span className="mb-1 block text-xs text-slate-400">Tools</span>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TOOLS.map((tool) => {
                  const checked = enabledTools.includes(tool.id);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => toggleCreateTool(tool.id)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                        checked
                          ? "border-emerald-500 bg-emerald-950/50 text-emerald-200"
                          : "border-slate-700 bg-slate-950 text-slate-400"
                      }`}
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
              className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create Agent"}
            </button>
          </form>
        </section>

        {/* Right Column: Selected Agent + Edit/Delete + Conversation + Trace */}
        <section className="space-y-6 lg:col-span-8">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            {!selectedAgent ? (
              <p className="text-sm text-slate-400">
                Select or create an agent to start a conversation.
              </p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {selectedAgent.name}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {selectedAgent.description || "No description"} ·{" "}
                      <span className="font-mono text-sky-300">
                        {selectedAgent.model}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1.5">
                      {selectedAgent.enabledTools.length === 0 ? (
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                          No tools
                        </span>
                      ) : (
                        selectedAgent.enabledTools.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300"
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
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-600"
                    >
                      {isEditing ? "Cancel Edit" : "Edit Agent"}
                    </button>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => void handleDeleteAgent(selectedAgent)}
                      className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-900/60 disabled:opacity-50"
                    >
                      {isDeleting ? "Deleting..." : "Delete Agent"}
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <form
                    onSubmit={handleSaveEdit}
                    className="mb-4 space-y-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3.5"
                  >
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                      Edit Agent Configuration
                    </h3>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">
                          Name
                        </label>
                        <input
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-400">
                          Model
                        </label>
                        <select
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                        >
                          {!models.some((m) => m.id === editModel) && (
                            <option value={editModel}>{editModel} (Current)</option>
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
                      <label className="mb-1 block text-xs text-slate-400">
                        Description
                      </label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-400">
                        System Prompt
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={editSystemPrompt}
                        onChange={(e) => setEditSystemPrompt(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <span className="mb-1 block text-xs text-slate-400">
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
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                                checked
                                  ? "border-emerald-500 bg-emerald-950/50 text-emerald-200"
                                  : "border-slate-700 bg-slate-900 text-slate-400"
                              }`}
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
                        className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                      >
                        {isSavingEdit ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                )}

                <form onSubmit={handleRunPrompt} className="flex gap-2">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask something that uses tools or runbooks, e.g. Calculate (120 * 0.15) + 45"
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isRunning || !prompt.trim()}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isRunning ? "Running..." : "Send"}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Execution History & Trace Inspector */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 md:col-span-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
                Executions ({executions.length})
              </h3>
              {executions.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No executions recorded yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {executions.map((exec) => {
                    const active = exec.id === selectedExecution?.id;
                    return (
                      <li key={exec.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedExecutionId(exec.id)}
                          className={`w-full rounded-lg border p-2.5 text-left text-xs transition ${
                            active
                              ? "border-sky-500 bg-sky-950/40 text-white"
                              : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold uppercase">
                              {exec.status}
                            </span>
                            <span className="text-slate-500">
                              {exec.trace.length} steps
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-slate-300">
                            {exec.prompt}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 md:col-span-7">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
                Execution Trace
              </h3>
              {!selectedExecution ? (
                <p className="text-xs text-slate-500">
                  Select an execution to inspect its trace steps.
                </p>
              ) : (
                <div className="space-y-4">
                  {selectedExecution.response && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="mb-1 text-xs font-semibold text-sky-400">
                        Final Response
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-slate-100">
                        {selectedExecution.response}
                      </p>
                    </div>
                  )}

                  <ol className="space-y-2">
                    {selectedExecution.trace.map((step) => (
                      <li
                        key={`${selectedExecution.id}-${step.step}`}
                        className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-amber-300">
                            #{step.step} · {step.type}
                          </span>
                          <span className="text-slate-500">
                            {new Date(step.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-200">{step.summary}</p>
                        {step.payload && (
                          <pre className="mt-1.5 overflow-x-auto rounded bg-slate-900 p-2 text-[11px] text-slate-400">
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
