import { Check, FileText, Plus } from "lucide-react";
import { DocumentDTO } from "@/lib/api";

interface DocumentSelectorProps {
  label: string;
  documents: DocumentDTO[];
  selectedDocumentIds: string[];
  onToggle: (documentId: string) => void;
  keyPrefix?: string;
  inactiveSurface?: "tertiary" | "secondary";
  compact?: boolean;
}

export function DocumentSelector({
  label,
  documents,
  selectedDocumentIds,
  onToggle,
  keyPrefix = "",
  inactiveSurface = "tertiary",
  compact = false,
}: DocumentSelectorProps) {
  const inactiveBg =
    inactiveSurface === "secondary"
      ? "var(--bg-secondary)"
      : "var(--bg-tertiary)";

  return (
    <div>
      <div
        className={`${compact ? "mb-1" : "mb-1.5"} flex items-center justify-between text-xs font-medium`}
        style={{ color: "var(--text-secondary)" }}
      >
        <span>{label}</span>
        <span
          className="font-mono-tech text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          {selectedDocumentIds.length} selected
        </span>
      </div>

      {documents.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No documents in your account yet. Upload one in Account Documents to attach it here.
        </p>
      ) : (
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
          {documents.map((doc) => {
            const checked = selectedDocumentIds.includes(doc.id);
            return (
              <button
                key={`${keyPrefix}${doc.id}`}
                type="button"
                onClick={() => onToggle(doc.id)}
                title={`${doc.fileName} · ${doc.chunkCount} chunks · ${doc.embeddingProvider}/${doc.embeddingModel}`}
                className={`flex max-w-full items-center gap-1.5 rounded-[3px] border px-2.5 ${compact ? "py-1" : "py-1.5"} text-left text-xs font-medium transition-all duration-200`}
                style={
                  checked
                    ? {
                        backgroundColor: "var(--badge-active-bg)",
                        borderColor: "var(--badge-active-border)",
                        color: "var(--badge-active-text)",
                      }
                    : {
                        backgroundColor: inactiveBg,
                        borderColor: "var(--border-default)",
                        color: "var(--text-secondary)",
                      }
                }
              >
                {checked ? (
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Plus
                    className="h-3.5 w-3.5 shrink-0 opacity-60"
                    aria-hidden="true"
                  />
                )}
                <FileText className="h-3 w-3 shrink-0 opacity-75" aria-hidden="true" />
                <span className="truncate">{doc.title}</span>
                <span className="font-mono-tech shrink-0 text-[10px] opacity-70">
                  ({doc.chunkCount})
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
