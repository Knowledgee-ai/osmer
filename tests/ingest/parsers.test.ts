import { describe, it, expect } from 'vitest';
import { markdownParser } from '@/lib/ingest/parsers/markdown';
import { chatgptExportParser } from '@/lib/ingest/parsers/chatgpt-export';
import { pickParser } from '@/lib/ingest/parsers';

describe('markdownParser', () => {
  it('extracts a title and produces chunks', async () => {
    const buf = new TextEncoder().encode('# Hello\n\n' + 'World of test content. '.repeat(50)).buffer;
    const r = await markdownParser.parse(buf, 'doc.md');
    expect(r.title).toBe('Hello');
    expect(r.chunks.length).toBeGreaterThan(0);
  });

  it('falls back to filename as title', async () => {
    const buf = new TextEncoder().encode('Some text without a heading. '.repeat(40)).buffer;
    const r = await markdownParser.parse(buf, 'untitled.md');
    expect(r.title).toBe('untitled.md');
  });
});

describe('chatgptExportParser', () => {
  it('parses a minimal conversations.json', async () => {
    const data = [{
      title: 'Test thread',
      create_time: 1700000000,
      mapping: {
        a: { message: { author: { role: 'user' }, content: { parts: ['Hello'] } }, parent: null, children: ['b'] },
        b: { message: { author: { role: 'assistant' }, content: { parts: ['Hi there'] } }, parent: 'a', children: [] },
      },
    }];
    const buf = new TextEncoder().encode(JSON.stringify(data)).buffer;
    const r = await chatgptExportParser.parse(buf, 'conversations.json');
    expect(r.chunks.length).toBe(2);
    expect(r.chunks[0].content).toContain('Hello');
    expect(r.chunks[1].content).toContain('Hi there');
  });
});

describe('pickParser', () => {
  it('routes by mime + extension', () => {
    expect(pickParser('text/markdown', 'foo.md')?.matches('text/markdown', 'foo.md')).toBe(true);
    expect(pickParser('application/pdf', 'foo.pdf')?.matches('application/pdf', 'foo.pdf')).toBe(true);
    expect(pickParser('application/json', 'conversations.json')).toBe(chatgptExportParser);
    expect(pickParser('application/x-fake', 'unknown.xyz')).toBe(null);
  });
});
