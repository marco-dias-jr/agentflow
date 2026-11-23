import { ParserStrategy } from "../../domain/entities/Document";

export interface ParseDocumentOptions {
  strategy?: ParserStrategy;
  normalizeWhitespace?: boolean;
}

export interface DocumentParserPort {
  parseToText(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    options?: ParseDocumentOptions
  ): string;
}
