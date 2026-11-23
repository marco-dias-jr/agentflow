"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./Button";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  targetName: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  description,
  targetName,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isProcessing = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!isProcessing) onCancel();
        }}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        className="af-card animate-slide-reveal relative z-10 my-auto w-full max-w-md rounded-[4px] border p-6 shadow-2xl"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border-strong)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border"
              style={{
                backgroundColor: "var(--danger-bg)",
                borderColor: "var(--danger-border)",
                color: "var(--danger-text)",
              }}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </div>
            <h3
              id="confirm-modal-title"
              className="font-display text-base font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="rounded-[4px] p-1 opacity-70 transition-opacity hover:opacity-100 disabled:opacity-30"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p
          className="mt-3 text-xs leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {description}
        </p>

        {targetName && (
          <div
            className="af-surface-inset mt-3 rounded-[4px] border px-3 py-2 text-xs font-semibold"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            {targetName}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <Button
            variant="secondary"
            disabled={isProcessing}
            onClick={onCancel}
            className="rounded-[4px] px-3.5 py-2 text-xs font-medium"
          >
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            disabled={isProcessing}
            onClick={onConfirm}
            className="rounded-[4px] px-4 py-2 text-xs font-semibold"
          >
            {isProcessing ? "Deleting..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
