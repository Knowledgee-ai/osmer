import { markdownParser } from './markdown';
import { pdfParser } from './pdf';
import { docxParser } from './docx';
import { pptxParser } from './pptx';
import { xlsxParser } from './xlsx';
import { chatgptExportParser } from './chatgpt-export';
import { claudeExportParser } from './claude-export';
import type { Parser, ParserResult } from '../types';

// Order matters — more specific parsers (exports) come before generic
// catch-alls (markdown matches text/plain).
const PARSERS: Parser[] = [
  chatgptExportParser,
  claudeExportParser,
  pdfParser,
  docxParser,
  pptxParser,
  xlsxParser,
  markdownParser,
];

export function pickParser(mime: string, filename: string): Parser | null {
  return PARSERS.find((p) => p.matches(mime, filename)) ?? null;
}

export async function parseFile(mime: string, filename: string, buffer: ArrayBuffer): Promise<ParserResult> {
  const parser = pickParser(mime, filename);
  if (!parser) throw new Error(`No parser for ${mime} (${filename})`);
  return parser.parse(buffer, filename);
}
