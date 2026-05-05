export interface ParserChunk {
  ord: number;
  content: string;
  meta?: Record<string, unknown>;
}

export interface ParserResult {
  title: string | null;
  chunks: ParserChunk[];
}

export interface Parser {
  matches(mime: string, filename: string): boolean;
  parse(buffer: ArrayBuffer, filename: string): Promise<ParserResult>;
}
