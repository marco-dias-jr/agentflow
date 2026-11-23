import {
  DocumentParserPort,
  ParseDocumentOptions,
} from "../../application/ports/DocumentParserPort";

export class DocumentParser implements DocumentParserPort {
  public parseToText(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    options?: ParseDocumentOptions
  ): string {
    const strategy = options?.strategy ?? "lightweight";
    const normalizeWhitespace = options?.normalizeWhitespace ?? false;
    const normalizedMime = mimeType.toLowerCase();
    const lowerName = fileName.toLowerCase();

    if (
      normalizedMime.startsWith("text/") ||
      normalizedMime === "application/json" ||
      /\.(txt|md|markdown|csv|json|log)$/.test(lowerName)
    ) {
      const text = buffer.toString("utf-8").replace(/\r\n/g, "\n").trim();
      return normalizeWhitespace
        ? text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
        : text;
    }

    if (normalizedMime === "application/pdf" || lowerName.endsWith(".pdf")) {
      if (strategy === "strict") {
        throw new Error(
          "Strict parser strategy only supports plain UTF-8 text formats (.txt, .md, .csv, .json, .log)."
        );
      }

      // Lightweight text stream extraction for text-based PDFs
      const raw = buffer.toString("latin1");
      const matches = Array.from(raw.matchAll(/\(([^()]{2,500})\)/g));
      const extracted = matches
        .map((m) =>
          m[1]
            .replace(/\\([()\\])/g, "$1")
            .replace(/[^\x20-\x7E\n]/g, " ")
            .trim()
        )
        .filter((part) => part.length > 1)
        .join(" ");

      return extracted.replace(/\s+/g, " ").trim();
    }

    throw new Error(
      `Unsupported file format (${mimeType || fileName}). Use .txt, .md, .csv, .json, or .pdf.`
    );
  }
}
