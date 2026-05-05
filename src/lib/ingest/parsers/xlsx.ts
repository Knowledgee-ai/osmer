import * as XLSX from 'xlsx';
import type { Parser, ParserChunk } from '../types';

export const xlsxParser: Parser = {
  matches: (mime, name) =>
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    name.toLowerCase().endsWith('.xlsx'),
  async parse(buffer, filename) {
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const chunks: ParserChunk[] = [];
    let ord = 0;
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      const lines = csv.split('\n');
      for (let i = 0; i < lines.length; i += 50) {
        const block = lines.slice(i, i + 50).join('\n');
        if (block.trim().length > 0) {
          chunks.push({ ord: ord++, content: `[Sheet: ${name}]\n${block}`, meta: { sheet: name, rowStart: i + 1 } });
        }
      }
    }
    return { title: filename, chunks };
  },
};
