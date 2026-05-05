export interface ChunkOpts {
  maxTokens?: number;
  overlapTokens?: number;
}

export interface ChunkOutput {
  ord: number;
  content: string;
  approxTokens: number;
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9])/g;
const TOKEN_PER_CHAR = 1 / 4;

/**
 * Sentence-aware chunker. Greedily packs sentences into a chunk up to
 * `maxTokens`, with an `overlapTokens`-sized tail included at the start
 * of the next chunk so adjacent chunks share context.
 */
export function chunkText(text: string, opts: ChunkOpts = {}): ChunkOutput[] {
  const maxTokens = opts.maxTokens ?? 700;
  const overlapTokens = opts.overlapTokens ?? 80;
  const maxChars = Math.floor(maxTokens / TOKEN_PER_CHAR);
  const overlapChars = Math.floor(overlapTokens / TOKEN_PER_CHAR);

  const sentences = text.split(SENTENCE_SPLIT);
  const chunks: ChunkOutput[] = [];
  let buf = '';
  let ord = 0;

  for (const s of sentences) {
    const candidate = buf ? `${buf} ${s}` : s;
    if (candidate.length > maxChars && buf.length > 0) {
      chunks.push({ ord: ord++, content: buf.trim(), approxTokens: Math.ceil(buf.length * TOKEN_PER_CHAR) });
      const tail = buf.slice(-overlapChars);
      buf = `${tail} ${s}`.trim();
    } else {
      buf = candidate;
    }
  }
  if (buf.trim().length > 0) {
    chunks.push({ ord: ord++, content: buf.trim(), approxTokens: Math.ceil(buf.length * TOKEN_PER_CHAR) });
  }
  return chunks;
}
