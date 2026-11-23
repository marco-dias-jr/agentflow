import { useState, useMemo } from "react";
import { Check, FileText, Plus, Search, X } from "lucide-react";
import { DocumentDTO } from "@/lib/api";

interface DocumentSelectorProps {
  label: string;
  documents: DocumentDTO[];
  selectedDocumentIds: string[];
  onToggle: (documentId: string) => void;
  keyPrefix?: string;
  inactiveSurface?: "tertiary" | "secondary";
  compact?: boolean;
  disabled?: boolean;
}

export function DocumentSelector({
  label,
  documents,
  selectedDocumentIds,
  onToggle,
  keyPrefix = "",
  inactiveSurface = "tertiary",
  compact = false,
  disabled = false,
}: DocumentSelectorProps) {
  const [filterQuery, setFilterQuery] = useState("");

  const inactiveBg =
    inactiveSurface === "secondary"
      ? "var(--bg-secondary)"
      : "var(--bg-tertiary)";

  const filteredDocuments = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q)
    );
  }, [documents, filterQuery]);

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
        <div className="space-y-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
              aria-hidden="true"
            />
            <input
              type="text"
              value={filterQuery}
              disabled={disabled}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter account documents..."
              className="af-input w-full rounded-[4px] py-1.5 pl-8 pr-7 text-xs disabled:opacity-50"
            />
            {filterQuery && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setFilterQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-xs opacity-60 hover:opacity-100 disabled:opacity-30 disabled:pointer-events-none"
                style={{ color: "var(--text-muted)" }}
                aria-label="Clear filter"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto pr-1">
            {filteredDocuments.length === 0 ? (
              <p className="py-2 text-xs" style={{ color: "var(--text-muted)" }}>
                No documents match &quot;{filterQuery}&quot;.
              </p>
            ) : (
              filteredDocuments.map((doc) => {
                const checked = selectedDocumentIds.includes(doc.id);
                return (
                  <button
                    key={`${keyPrefix}${doc.id}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => onToggle(doc.id)}
                    title={`${doc.fileName} · ${doc.chunkCount} chunks · ${doc.embeddingProvider}/${doc.embeddingModel}`}
                    className={`flex max-w-full items-center gap-1.5 rounded-[4px] border px-2.5 ${compact ? "py-1" : "py-1.5"} text-left text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none`}
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
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
