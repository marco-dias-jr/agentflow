"use client";

import { FormEvent, useEffect } from "react";
import { Bot, Pencil, Plus, X } from "lucide-react";
import { Button } from "./Button";
import { DocumentSelector } from "./DocumentSelector";
import { FieldLabel, Input, Select, Textarea } from "./Input";
import { ToolOption, ToolSelector } from "./ToolSelector";
import { DocumentDTO, ModelOptionDTO } from "@/lib/api";

interface AgentFormModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  // Form values
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  provider: string;
  onProviderChange: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  enabledTools: string[];
  onToggleTool: (toolId: string) => void;
  selectedDocumentIds: string[];
  onToggleDocument: (docId: string) => void;
  // Options
  availableProviders: { id: string; label: string }[];
  modelsForProvider: ModelOptionDTO[];
  availableTools: ToolOption[];
  documents: DocumentDTO[];
  // Submission
  isSubmitting: boolean;
  onSubmit: (e: FormEvent) => void;
}

export function AgentFormModal({
  isOpen,
  mode,
  onClose,
  name,
  setName,
  description,
  setDescription,
  systemPrompt,
  setSystemPrompt,
  provider,
  onProviderChange,
  model,
  setModel,
  enabledTools,
  onToggleTool,
  selectedDocumentIds,
  onToggleDocument,
  availableProviders,
  modelsForProvider,
  availableTools,
  documents,
  isSubmitting,
  onSubmit,
}: AgentFormModalProps) {
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isEdit = mode === "edit";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-form-modal-title"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        className="af-card animate-slide-reveal relative z-10 my-auto w-full max-w-2xl rounded-[4px] border p-6 shadow-2xl"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border-strong)",
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b pb-4" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            >
              {isEdit ? <Pencil className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div>
              <h3
                id="agent-form-modal-title"
                className="font-display text-base font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {isEdit ? "Edit Agent" : "Create New Agent"}
              </h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {isEdit
                  ? "Update configuration, model parameters, tools, or linked documents."
                  : "Configure prompt behavior, model choice, assigned tools, and knowledge runbooks."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-[4px] p-1 opacity-70 transition-opacity hover:opacity-100 disabled:opacity-30"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <FieldLabel className="mb-1.5">Name</FieldLabel>
            <Input
              type="text"
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Support Assistant"
              className="rounded-[4px] px-3.5 py-2"
            />
          </div>

          <div>
            <FieldLabel className="mb-1.5">Description</FieldLabel>
            <Input
              type="text"
              disabled={isSubmitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Handles operational troubleshooting and calculations"
              className="rounded-[4px] px-3.5 py-2"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel className="mb-1.5">Provider</FieldLabel>
              <Select
                value={provider}
                onChange={(e) => onProviderChange(e.target.value)}
                disabled={isSubmitting || availableProviders.length === 0}
                className="rounded-[4px] px-3.5 py-2"
              >
                {availableProviders.length === 0 ? (
                  <option value="">No providers in .env</option>
                ) : (
                  availableProviders.map((prov) => (
                    <option key={`modal-prov-${prov.id}`} value={prov.id}>
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
                disabled={isSubmitting || modelsForProvider.length === 0}
                className="rounded-[4px] px-3.5 py-2"
              >
                {modelsForProvider.length === 0 ? (
                  <option value="">No models configured</option>
                ) : (
                  modelsForProvider.map((opt) => (
                    <option key={`modal-model-${opt.provider}-${opt.id}`} value={opt.id}>
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
              disabled={isSubmitting}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="rounded-[4px] px-3.5 py-2"
            />
          </div>

          <ToolSelector
            label="Assigned Tools"
            tools={availableTools}
            selectedTools={enabledTools}
            onToggle={onToggleTool}
            disabled={isSubmitting}
            keyPrefix={isEdit ? "edit-tool-" : "create-tool-"}
          />

          <DocumentSelector
            label="Account Documents (Bounded & Searchable)"
            documents={documents}
            selectedDocumentIds={selectedDocumentIds}
            onToggle={onToggleDocument}
            disabled={isSubmitting}
            keyPrefix={isEdit ? "edit-doc-" : "create-doc-"}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <Button
              variant="secondary"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-[4px] px-4 py-2 text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim() || !provider || !model}
              className="rounded-[4px] px-5 py-2 text-xs font-semibold"
            >
              {isSubmitting
                ? isEdit
                  ? "Saving Changes..."
                  : "Creating Agent..."
                : isEdit
                  ? "Save Changes"
                  : "Create Agent"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
