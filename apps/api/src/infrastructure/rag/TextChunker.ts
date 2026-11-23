import { ChunkStrategy } from "../../domain/entities/Document";

export interface ChunkOptions {
  strategy?: ChunkStrategy;
  chunkSize?: number;
  overlap?: number;
}

export interface ResolvedChunkOptions {
  strategy: ChunkStrategy;
  chunkSize: number;
  overlap: number;
}

export class TextChunker {
  public resolveOptions(options?: ChunkOptions): ResolvedChunkOptions {
    const strategy: ChunkStrategy = options?.strategy ?? "fixed";
    const chunkSize = Math.max(100, Math.floor(options?.chunkSize ?? 800));
    const requestedOverlap = Math.max(0, Math.floor(options?.overlap ?? 120));
    const overlap = Math.min(requestedOverlap, Math.floor(chunkSize / 2));

    return {
      strategy,
      chunkSize,
      overlap,
    };
  }

  public chunk(text: string, options?: ChunkOptions): string[] {
    const { strategy, chunkSize, overlap } = this.resolveOptions(options);
    const clean = text.replace(/\n{3,}/g, "\n\n").trim();

    if (!clean) {
      return [];
    }

    if (clean.length <= chunkSize) {
      return [clean];
    }

    if (strategy === "paragraph") {
      const units = clean
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
      return this.packUnits(units, "\n\n", chunkSize, overlap);
    }

    if (strategy === "sentence") {
      const units = clean
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return this.packUnits(units, " ", chunkSize, overlap);
    }

    return this.fixedChunk(clean, chunkSize, overlap);
  }

  private fixedChunk(
    text: string,
    chunkSize: number,
    overlap: number
  ): string[] {
    const chunks: string[] = [];
    let start = 0;
    const step = Math.max(1, chunkSize - overlap);

    while (start < text.length) {
      const end = Math.min(text.length, start + chunkSize);
      const slice = text.slice(start, end).trim();
      if (slice) {
        chunks.push(slice);
      }
      if (end >= text.length) break;
      start += step;
    }

    return chunks;
  }

  private packUnits(
    units: string[],
    separator: string,
    chunkSize: number,
    overlap: number
  ): string[] {
    const chunks: string[] = [];
    let current = "";

    for (const unit of units) {
      if (unit.length > chunkSize) {
        if (current) {
          chunks.push(current);
          current = "";
        }
        chunks.push(...this.fixedChunk(unit, chunkSize, overlap));
        continue;
      }

      const candidate = current ? `${current}${separator}${unit}` : unit;
      if (candidate.length <= chunkSize) {
        current = candidate;
      } else {
        if (current) {
          chunks.push(current);
        }
        if (overlap > 0 && current) {
          const tail = current.slice(-overlap).trim();
          const withTail = tail ? `${tail}${separator}${unit}` : unit;
          current = withTail.length <= chunkSize ? withTail : unit;
        } else {
          current = unit;
        }
      }
    }

    if (current) {
      chunks.push(current);
    }

    return chunks;
  }
}
