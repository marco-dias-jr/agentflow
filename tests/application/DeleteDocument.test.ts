import { describe, expect, it, vi } from "vitest";
import { DeleteDocument } from "../../apps/api/src/application/use-cases/DeleteDocument";
import { Document } from "../../apps/api/src/domain/entities/Document";
import { DocumentRepository } from "../../apps/api/src/domain/repositories/DocumentRepository";

function createMockDocument(id: string, userId: string): Document {
  return new Document({
    id,
    userId,
    title: "Incident Runbook",
    fileName: "runbook.md",
    mimeType: "text/markdown",
    contentHash: `hash-${id}`,
    chunkCount: 4,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
}

describe("DeleteDocument Use Case", () => {
  it("deletes a document owned by the authenticated user", async () => {
    const ownedDoc = createMockDocument("doc-123", "user-1");
    const findByIdForUser = vi.fn().mockResolvedValue(ownedDoc);
    const deleteByIdForUser = vi.fn().mockResolvedValue(undefined);

    const repo = {
      findByIdForUser,
      deleteByIdForUser,
    } as unknown as DocumentRepository;

    const useCase = new DeleteDocument(repo);
    await useCase.execute("  doc-123  ", "user-1");

    expect(findByIdForUser).toHaveBeenCalledWith("doc-123", "user-1");
    expect(deleteByIdForUser).toHaveBeenCalledWith("doc-123", "user-1");
  });

  it("rejects empty document ids", async () => {
    const repo = {
      findByIdForUser: vi.fn(),
      deleteByIdForUser: vi.fn(),
    } as unknown as DocumentRepository;

    const useCase = new DeleteDocument(repo);
    await expect(useCase.execute("   ", "user-1")).rejects.toThrow(
      "Document id is required."
    );
  });

  it("throws when document is not found or belongs to another user", async () => {
    const findByIdForUser = vi.fn().mockResolvedValue(null);
    const deleteByIdForUser = vi.fn();

    const repo = {
      findByIdForUser,
      deleteByIdForUser,
    } as unknown as DocumentRepository;

    const useCase = new DeleteDocument(repo);
    await expect(useCase.execute("doc-999", "user-2")).rejects.toThrow(
      "Document not found: doc-999"
    );
    expect(deleteByIdForUser).not.toHaveBeenCalled();
  });
});
