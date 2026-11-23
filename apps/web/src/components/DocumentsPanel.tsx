"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileText, FileUp, Search, Trash2, Upload, X } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldLabel, Input, Select } from "@/components/ui/Input";
import {
  DocumentDTO,
  getUserFriendlyError,
  uploadDocument,
} from "@/lib/api";

interface DocumentsPanelProps {
  documents: DocumentDTO[];
  onDocumentUploaded: (doc: DocumentDTO, deduplicated: boolean) => void;
  onRequestDeleteDocument?: (doc: DocumentDTO) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unable to read file contents."));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read selected file."));
    reader.readAsDataURL(file);
  });
}

export function DocumentsPanel({
  documents,
  onDocumentUploaded,
  onRequestDeleteDocument,
}: DocumentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showRagOptions, setShowRagOptions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Optional RAG pipeline settings (Phase B1)
  const [parserStrategy, setParserStrategy] = useState<"lightweight" | "strict">(
    "lightweight"
  );
  const [chunkStrategy, setChunkStrategy] = useState<
    "fixed" | "paragraph" | "sentence"
  >("fixed");
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(120);
  const [embeddingProvider, setEmbeddingProvider] = useState<
    "auto" | "gemini" | "ollama" | "local"
  >("auto");
  const [embeddingModel, setEmbeddingModel] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: "info" | "error";
    message: string;
  } | null>(null);

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        doc.embeddingProvider.toLowerCase().includes(q) ||
        doc.chunkStrategy.toLowerCase().includes(q)
    );
  }, [documents, searchQuery]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setFeedback({
        variant: "error",
        message: "Select a file (.txt, .md, .csv, .json, .log, or .pdf) first.",
      });
      return;
    }

    setFeedback(null);
    setIsUploading(true);
    try {
      const contentBase64 = await fileToBase64(selectedFile);
      const result = await uploadDocument({
        title: title.trim() || undefined,
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "text/plain",
        contentBase64,
        parserStrategy,
        chunkStrategy,
        chunkSize,
        chunkOverlap,
        embeddingProvider,
        embeddingModel: embeddingModel.trim() || undefined,
      });

      onDocumentUploaded(result.document, result.deduplicated);
      setTitle("");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setFeedback({
        variant: "info",
        message: result.deduplicated
          ? `Reused existing document "${result.document.title}" from your account (no duplicate embedding cost).`
          : `Indexed "${result.document.title}" (${result.document.chunkCount} chunks · ${result.document.embeddingProvider}/${result.document.embeddingModel}).`,
      });
    } catch (err) {
      setFeedback({
        variant: "error",
        message: getUserFriendlyError(
          err,
          "We couldn't upload and index this document right now. Please check the file and try again."
        ),
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card className="space-y-4 rounded-[4px] p-5">
      <div className="flex items-center justify-between">
        <h2
          className="font-display text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-secondary)" }}
        >
          Account Documents ({documents.length})
        </h2>
        <span
          className="font-mono-tech text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          RAG Library
        </span>
      </div>

      {feedback && (
        <AlertBanner
          variant={feedback.variant}
          className="rounded-[4px] px-3 py-2 text-xs"
          onDismiss={() => setFeedback(null)}
        >
          {feedback.message}
        </AlertBanner>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <FieldLabel className="mb-1.5">Title (optional)</FieldLabel>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isUploading}
            placeholder="Incident Runbook v2"
            className="rounded-[4px] px-3 py-1.5"
          />
        </div>

        <div>
          <FieldLabel className="mb-1.5">File (.txt, .md, .csv, .json, .pdf)</FieldLabel>
          <input
            ref={fileInputRef}
            type="file"
            id="document-file-input"
            accept=".txt,.md,.markdown,.csv,.json,.log,.pdf,text/plain,text/markdown,text/csv,application/json,application/pdf"
            disabled={isUploading}
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="af-btn-secondary inline-flex items-center gap-1.5 rounded-[4px] border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
              style={{ borderColor: "var(--border-default)" }}
            >
              <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{selectedFile ? "Change file" : "Choose file"}</span>
            </button>
            {selectedFile ? (
              <div
                className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-[4px] px-2 py-1 text-xs"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)" }}
              >
                <span className="truncate" title={selectedFile.name} style={{ color: "var(--text-primary)" }}>
                  {selectedFile.name}
                </span>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="rounded p-0.5 text-xs opacity-70 transition-opacity hover:opacity-100 disabled:opacity-30 disabled:pointer-events-none"
                  style={{ color: "var(--text-muted)" }}
                  title="Remove selected file"
                  aria-label="Remove selected file"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <span className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                No file chosen
              </span>
            )}
          </div>
        </div>

        <div>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => setShowRagOptions((prev) => !prev)}
            className="flex items-center gap-1 text-xs font-medium opacity-80 transition-opacity hover:opacity-100 disabled:opacity-50 disabled:pointer-events-none"
            style={{ color: "var(--text-secondary)" }}
          >
            {showRagOptions ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            RAG Pipeline Options
          </button>

          {showRagOptions && (
            <div className="af-surface-inset mt-2 space-y-2.5 rounded-[4px] p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Parser</FieldLabel>
                  <Select
                    value={parserStrategy}
                    disabled={isUploading}
                    onChange={(e) =>
                      setParserStrategy(
                        e.target.value as "lightweight" | "strict"
                      )
                    }
                    className="rounded-[4px] px-2.5 py-1 text-xs"
                  >
                    <option value="lightweight">Lightweight</option>
                    <option value="strict">Strict UTF-8</option>
                  </Select>
                </div>

                <div>
                  <FieldLabel>Chunking</FieldLabel>
                  <Select
                    value={chunkStrategy}
                    disabled={isUploading}
                    onChange={(e) =>
                      setChunkStrategy(
                        e.target.value as "fixed" | "paragraph" | "sentence"
                      )
                    }
                    className="rounded-[4px] px-2.5 py-1 text-xs"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="paragraph">Paragraph</option>
                    <option value="sentence">Sentence</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Chunk Size</FieldLabel>
                  <Input
                    type="number"
                    min={100}
                    max={4000}
                    value={chunkSize}
                    disabled={isUploading}
                    onChange={(e) =>
                      setChunkSize(Number(e.target.value) || 800)
                    }
                    className="rounded-[4px] px-2.5 py-1 text-xs"
                  />
                </div>
                <div>
                  <FieldLabel>Overlap</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    max={2000}
                    value={chunkOverlap}
                    disabled={isUploading}
                    onChange={(e) =>
                      setChunkOverlap(Number(e.target.value) || 0)
                    }
                    className="rounded-[4px] px-2.5 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Embedding Provider</FieldLabel>
                  <Select
                    value={embeddingProvider}
                    disabled={isUploading}
                    onChange={(e) =>
                      setEmbeddingProvider(
                        e.target.value as "auto" | "gemini" | "ollama" | "local"
                      )
                    }
                    className="rounded-[4px] px-2.5 py-1 text-xs"
                  >
                    <option value="auto">Auto</option>
                    <option value="gemini">Gemini</option>
                    <option value="ollama">Ollama</option>
                    <option value="local">Local (128d)</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Embedding Model</FieldLabel>
                  <Input
                    type="text"
                    value={embeddingModel}
                    disabled={isUploading}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    placeholder="Default"
                    className="rounded-[4px] px-2.5 py-1 text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <Button
          type="submit"
          variant="secondary"
          disabled={isUploading || !selectedFile}
          className="flex w-full items-center justify-center gap-1.5 rounded-[4px] px-3 py-2 text-xs font-semibold"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {isUploading ? "Indexing..." : "Upload Document"}
        </Button>
      </form>

      <div
        className="space-y-2 border-t pt-3"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search account documents..."
            className="af-input w-full rounded-[4px] py-1.5 pl-8 pr-7 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-xs opacity-60 hover:opacity-100"
              style={{ color: "var(--text-muted)" }}
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {documents.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No documents uploaded yet. Files uploaded here can be reused across any of your agents.
          </p>
        ) : filteredDocuments.length === 0 ? (
          <p className="py-2 text-xs" style={{ color: "var(--text-muted)" }}>
            No documents match &quot;{searchQuery}&quot;.
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {filteredDocuments.map((doc) => (
              <li
                key={doc.id}
                className="af-surface-inset rounded-[4px] px-3 py-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <FileText
                      className="h-3.5 w-3.5 shrink-0 opacity-70"
                      aria-hidden="true"
                    />
                    <span
                      className="truncate font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {doc.title}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className="font-mono-tech text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {doc.chunkCount} chunks
                    </span>
                    {onRequestDeleteDocument && (
                      <button
                        type="button"
                        onClick={() => onRequestDeleteDocument(doc)}
                        className="rounded-[4px] p-1 opacity-70 transition-opacity hover:opacity-100"
                        style={{ color: "var(--danger-text)" }}
                        title="Delete document"
                        aria-label={`Delete ${doc.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                <div
                  className="font-mono-tech mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span className="truncate">{doc.fileName}</span>
                  <span>
                    {doc.chunkStrategy} · {doc.embeddingProvider} ·{" "}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
