import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { DeleteDocument } from "../../application/use-cases/DeleteDocument";
import { IngestDocument } from "../../application/use-cases/IngestDocument";
import { DocumentRepository } from "../../domain/repositories/DocumentRepository";
import { ingestDocumentSchema } from "../dto/IngestDocumentDto";
import { AuthenticatedRequest, AuthGuard } from "../security/AuthGuard";

export const DOCUMENT_REPOSITORY_TOKEN = Symbol("DOCUMENT_REPOSITORY_TOKEN");
export const INGEST_DOCUMENT_USE_CASE_TOKEN = Symbol(
  "INGEST_DOCUMENT_USE_CASE_TOKEN"
);
export const DELETE_DOCUMENT_USE_CASE_TOKEN = Symbol(
  "DELETE_DOCUMENT_USE_CASE_TOKEN"
);

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB

@Controller("documents")
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(
    @Inject(INGEST_DOCUMENT_USE_CASE_TOKEN)
    private readonly ingestDocumentUseCase: IngestDocument,
    @Inject(DELETE_DOCUMENT_USE_CASE_TOKEN)
    private readonly deleteDocumentUseCase: DeleteDocument,
    @Inject(DOCUMENT_REPOSITORY_TOKEN)
    private readonly documentRepository: DocumentRepository
  ) {}

  @Post()
  public async upload(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const parsed = ingestDocumentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid document upload payload",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data;
    const contentBuffer = data.contentBase64
      ? Buffer.from(data.contentBase64, "base64")
      : Buffer.from(data.contentText ?? "", "utf-8");

    if (contentBuffer.byteLength === 0) {
      throw new BadRequestException("Document content cannot be empty.");
    }

    if (contentBuffer.byteLength > MAX_DOCUMENT_BYTES) {
      throw new BadRequestException(
        "Document exceeds the maximum allowed size of 5 MB."
      );
    }

    const userId = req.user!.id;

    try {
      const result = await this.ingestDocumentUseCase.execute({
        userId,
        title: data.title,
        fileName: data.fileName,
        mimeType: data.mimeType,
        contentBuffer,
        parser:
          data.parserStrategy || data.normalizeWhitespace !== undefined
            ? {
                strategy: data.parserStrategy,
                normalizeWhitespace: data.normalizeWhitespace,
              }
            : undefined,
        chunking:
          data.chunkStrategy ||
          data.chunkSize !== undefined ||
          data.chunkOverlap !== undefined
            ? {
                strategy: data.chunkStrategy,
                chunkSize: data.chunkSize,
                overlap: data.chunkOverlap,
              }
            : undefined,
        embedding:
          data.embeddingProvider || data.embeddingModel
            ? {
                provider: data.embeddingProvider,
                model: data.embeddingModel,
              }
            : undefined,
      });

      console.log(
        `[API] Document ${result.document.id} (${result.document.fileName}, chunks=${result.document.chunkCount}, deduplicated=${result.deduplicated}, user=${userId})`
      );

      return {
        data: result,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to ingest document";
      throw new BadRequestException(message);
    }
  }

  @Get()
  public async list(@Req() req: AuthenticatedRequest) {
    const documents = await this.documentRepository.findAllByUserId(
      req.user!.id
    );
    return { data: documents };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async remove(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest
  ) {
    try {
      await this.deleteDocumentUseCase.execute(id, req.user!.id);
      console.log(`[API] Deleted document ${id} (user=${req.user!.id})`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete document";
      if (message.startsWith("Document not found:")) {
        throw new NotFoundException(message);
      }
      throw new BadRequestException(message);
    }
  }
}
