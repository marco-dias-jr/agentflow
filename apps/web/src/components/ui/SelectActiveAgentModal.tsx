"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Check, Cpu, FileText, Search, X } from "lucide-react";
import { AgentDTO } from "@/lib/api";

interface SelectActiveAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentDTO[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  onCreateNew?: () => void;
}

export function SelectActiveAgentModal({
  isOpen,
  onClose,
  agents,
  selectedAgentId,
  onSelectAgent,
  onCreateNew,
}: SelectActiveAgentModalProps) {
  const [filterQuery, setFilterQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFilterQuery("");
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const filteredAgents = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(q) ||
        (agent.description && agent.description.toLowerCase().includes(q)) ||
        agent.provider.toLowerCase().includes(q) ||
        agent.model.toLowerCase().includes(q)
    );
  }, [agents, filterQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="select-active-agent-title"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        className="af-card animate-slide-reveal relative z-10 my-auto w-full max-w-lg rounded-[4px] border p-5 shadow-2xl"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border-strong)",
        }}
      >
        <div className="flex items-center justify-between border-b pb-3.5" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[4px] border"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            >
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h3
                id="select-active-agent-title"
                className="font-display text-sm font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                Switch Active Agent
              </h3>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                Select an agent to chat and inspect executions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-1 opacity-70 transition-opacity hover:opacity-100"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Input */}
        <div className="mt-3.5 relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
            aria-hidden="true"
          />
          <input
            type="text"
            autoFocus
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search agents by name, model or description..."
            className="af-input w-full rounded-[4px] py-2 pl-9 pr-8 text-xs"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-xs opacity-60 hover:opacity-100"
              style={{ color: "var(--text-muted)" }}
              aria-label="Clear filter"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Agents List */}
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {agents.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
              <p>No agents available in your account.</p>
              {onCreateNew && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateNew();
                  }}
                  className="mt-2 text-xs underline font-medium hover:opacity-100"
                  style={{ color: "var(--text-primary)" }}
                >
                  Create an agent now
                </button>
              )}
            </div>
          ) : filteredAgents.length === 0 ? (
            <p className="py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
              No agents match &quot;{filterQuery}&quot;.
            </p>
          ) : (
            filteredAgents.map((agent) => {
              const isSelected = agent.id === selectedAgentId;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    onSelectAgent(agent.id);
                    onClose();
                  }}
                  className={`w-full rounded-[4px] border p-3 text-left transition-all ${
                    isSelected ? "af-item-card-active" : "af-item-card"
                  }`}
                  style={{
                    borderColor: isSelected
                      ? "var(--border-strong)"
                      : "var(--border-subtle)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="font-display text-xs font-bold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {agent.name}
                    </span>
                    {isSelected && (
                      <span
                        className="font-mono-tech inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: "var(--accent-bg)",
                          color: "var(--accent-text)",
                          borderColor: "var(--accent-bg)",
                        }}
                      >
                        <Check className="h-2.5 w-2.5" />
                        Active
                      </span>
                    )}
                  </div>

                  {agent.description && (
                    <p
                      className="mt-1 line-clamp-1 text-[11px] leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {agent.description}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2 pt-1 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                    <span
                      className="font-mono-tech inline-flex items-center gap-1 text-[10px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Cpu className="h-2.5 w-2.5 opacity-70" />
                      {agent.provider} / {agent.model}
                    </span>
                    <span
                      className="font-mono-tech inline-flex items-center gap-1 text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <FileText className="h-2.5 w-2.5 opacity-70" />
                      {(agent.documentIds ?? []).length} docs
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
