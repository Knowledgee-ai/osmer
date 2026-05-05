import JSZip from 'jszip';
import type { Parser, ParserChunk } from '../types';

export const pptxParser: Parser = {
  matches: (mime, name) =>
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    name.toLowerCase().endsWith('.pptx'),
  async parse(buffer, filename) {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort();
    const chunks: ParserChunk[] = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async('text');
      const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 20) chunks.push({ ord: i, content: text, meta: { slide: i + 1 } });
    }
    return { title: filename, chunks };
  },
};
