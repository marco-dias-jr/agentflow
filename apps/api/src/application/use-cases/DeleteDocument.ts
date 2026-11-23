import { DocumentRepository } from "../../domain/repositories/DocumentRepository";

export class DeleteDocument {
  constructor(private readonly documentRepository: DocumentRepository) {}

  public async execute(documentId: string, userId: string): Promise<void> {
    const normalizedId = documentId.trim();
    if (!normalizedId) {
      throw new Error("Document id is required.");
    }

    const existing = await this.documentRepository.findByIdForUser(
      normalizedId,
      userId
    );
    if (!existing) {
      throw new Error(`Document not found: ${normalizedId}`);
    }

    await this.documentRepository.deleteByIdForUser(normalizedId, userId);
  }
}
