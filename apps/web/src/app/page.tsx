"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AgentDTO,
  createAgent,
  executeAgentPrompt,
  ExecutionDTO,
  listAgents,
  listExecutions,
} from "@/lib/api";

const AVAILABLE_TOOLS = [
  { id: "calculator", label: "Calculator" },
  { id: "knowledge_search", label: "Knowledge Search" },
];

export default function AgentFlowPage() {
  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [executions, setExecutions] = useState<ExecutionDTO[]>([]);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string>("");

  // Create agent form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful operational assistant. Use available tools when accurate calculations or runbooks are needed."
  );
  const [model, setModel] = useState("gemini-2.5-flash");
  const [enabledTools, setEnabledTools] = useState<string[]>([
    "calculator",
    "knowledge_search",
  ]);

  // Chat prompt state
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? null;

  const selectedExecution =
    executions.find((exec) => exec.id === selectedExecutionId) ??
    executions[0] ??
    null;

  async function refreshAgents(preferredId?: string) {
    try {
      const data = await listAgents();
      setAgents(data);
      if (preferredId) {
        setSelectedAgentId(preferredId);
      } else if (!selectedAgentId && data.length > 0) {
        setSelectedAgentId(data[0].id);
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
    void refreshAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      void refreshExecutions(selectedAgentId);
    }
  }, [selectedAgentId]);

  function toggleTool(toolId: string) {
    setEnabledTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((item) => item !== toolId)
        : [...prev, toolId]
    );
  }

  async function handleCreateAgent(e: FormEvent) {
    e.preventDefault();
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
      <header className="mb-8 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          AgentFlow — AI Agent Platform
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure agents, execute tool-calling prompts, and inspect execution traces.
        </p>
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
              <input
                type="text"
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gemini-2.5-flash"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
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
                      onClick={() => toggleTool(tool.id)}
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
              disabled={isCreating}
              className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create Agent"}
            </button>
          </form>
        </section>

        {/* Right Column: Conversation + Execution History + Execution Trace */}
        <section className="space-y-6 lg:col-span-8">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            {!selectedAgent ? (
              <p className="text-sm text-slate-400">
                Select or create an agent to start a conversation.
              </p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {selectedAgent.name}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {selectedAgent.description || "No description"} ·{" "}
                      {selectedAgent.model}
                    </p>
                  </div>
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
                </div>

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
