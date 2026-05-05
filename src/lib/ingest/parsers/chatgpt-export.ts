import type { Parser, ParserResult } from '../types';

interface CGNode {
  message: null | {
    author: { role: string };
    content: { parts: Array<string | { content_type?: string; text?: string }> };
    create_time?: number;
  };
  parent: string | null;
  children: string[];
}

interface CGConversation {
  title: string;
  create_time: number;
  mapping: Record<string, CGNode>;
}

export const chatgptExportParser: Parser = {
  matches: (_mime, name) => /conversations\.json$/i.test(name),
  async parse(buffer, _filename) {
    const text = new TextDecoder().decode(buffer);
    let json: unknown;
    try { json = JSON.parse(text); } catch { return { title: 'ChatGPT export', chunks: [] }; }
    if (!Array.isArray(json)) return { title: 'ChatGPT export', chunks: [] };

    const chunks: ParserResult['chunks'] = [];
    let ord = 0;
    for (const conv of json as CGConversation[]) {
      const root = Object.values(conv.mapping).find((n) => n.parent === null);
      let cur: CGNode | undefined = root;
      while (cur) {
        if (cur.message) {
          const parts = cur.message.content?.parts ?? [];
          const turnText = parts
            .map((p) => (typeof p === 'string' ? p : p.text ?? ''))
            .filter(Boolean)
            .join('\n');
          if (turnText) {
            chunks.push({
              ord: ord++,
              content: `[${cur.message.author.role}] ${turnText}`,
              meta: { conversation: conv.title, role: cur.message.author.role },
            });
          }
        }
        cur = cur.children[0] ? conv.mapping[cur.children[0]] : undefined;
      }
    }
    return { title: 'ChatGPT export', chunks };
  },
};
