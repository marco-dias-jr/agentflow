"use client";

import { FormEvent, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Upload } from "lucide-react";
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
}: DocumentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showRagOptions, setShowRagOptions] = useState(false);

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
    <Card className="space-y-4 p-5">
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
          className="px-3 py-2 text-xs"
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
            placeholder="Incident Runbook v2"
            className="px-3 py-1.5"
          />
        </div>

        <div>
          <FieldLabel className="mb-1.5">File (.txt, .md, .csv, .json, .pdf)</FieldLabel>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.markdown,.csv,.json,.log,.pdf,text/plain,text/markdown,text/csv,application/json,application/pdf"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="af-input block w-full cursor-pointer rounded-[3px] px-3 py-1.5 text-xs"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowRagOptions((prev) => !prev)}
            className="flex items-center gap-1 text-xs font-medium opacity-80 transition-opacity hover:opacity-100"
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
            <div className="af-surface-inset mt-2 space-y-2.5 rounded-[3px] p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Parser</FieldLabel>
                  <Select
                    value={parserStrategy}
                    onChange={(e) =>
                      setParserStrategy(
                        e.target.value as "lightweight" | "strict"
                      )
                    }
                    className="px-2.5 py-1 text-xs"
                  >
                    <option value="lightweight">Lightweight</option>
                    <option value="strict">Strict UTF-8</option>
                  </Select>
                </div>

                <div>
                  <FieldLabel>Chunking</FieldLabel>
                  <Select
                    value={chunkStrategy}
                    onChange={(e) =>
                      setChunkStrategy(
                        e.target.value as "fixed" | "paragraph" | "sentence"
                      )
                    }
                    className="px-2.5 py-1 text-xs"
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
                    onChange={(e) =>
                      setChunkSize(Number(e.target.value) || 800)
                    }
                    className="px-2.5 py-1 text-xs"
                  />
                </div>
                <div>
                  <FieldLabel>Overlap</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    max={2000}
                    value={chunkOverlap}
                    onChange={(e) =>
                      setChunkOverlap(Number(e.target.value) || 0)
                    }
                    className="px-2.5 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Embedding Provider</FieldLabel>
                  <Select
                    value={embeddingProvider}
                    onChange={(e) =>
                      setEmbeddingProvider(
                        e.target.value as "auto" | "gemini" | "ollama" | "local"
                      )
                    }
                    className="px-2.5 py-1 text-xs"
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
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    placeholder="Default"
                    className="px-2.5 py-1 text-xs"
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
          className="flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {isUploading ? "Indexing..." : "Upload Document"}
        </Button>
      </form>

      <div
        className="border-t pt-3"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {documents.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No documents uploaded yet. Files uploaded here can be reused across any of your agents.
          </p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="af-surface-inset rounded-[3px] px-3 py-2 text-xs"
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
                  <span
                    className="font-mono-tech shrink-0 text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {doc.chunkCount} chunks
                  </span>
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
