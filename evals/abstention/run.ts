import { config } from 'dotenv';
config({ path: '.env.local' });

import fs from 'node:fs/promises';
import path from 'node:path';

interface Scenario { id: string; question: string; haystack_unrelated: string; }

const ABSTAIN_PHRASES = [
  /nothing.+touches on that/i,
  /no relevant/i,
  /(don't|do not|cannot)\s+(have|know|find)/i,
  /insufficient/i,
  /no evidence/i,
  /no information/i,
];

async function main() {
  const { db } = await import('../../src/lib/db');
  const { organizations, users } = await import('../../src/lib/db/schema');
  const { ingestSource } = await import('../../src/lib/memory/ingest');
  const { retrieve } = await import('../../src/lib/memory/retrieve');
  const { generateText } = await import('ai');
  const { getLanguageModel } = await import('../../src/lib/ai/router');

  const list = JSON.parse(await fs.readFile(path.resolve(process.cwd(), 'evals/abstention/scenarios.json'), 'utf8')) as Scenario[];

  let abstained = 0;
  for (const s of list) {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const [org] = await db.insert(organizations).values({ name: 'AB', slug: `ab-${stamp}` }).returning();
    const [u]   = await db.insert(users).values({ orgId: org.id, name: 'U', email: `ab-${stamp}@e.co`, role: 'member' }).returning();
    await ingestSource({ orgId: org.id, type: 'document', ownerUserId: u.id, title: 'h', chunks: [{ ord: 0, content: s.haystack_unrelated }] });

    const results = await retrieve({
      query: s.question,
      scope: { userId: u.id, teamIds: [], orgId: org.id, includeOrg: true },
      topN: 5,
    });

    // If retrieval finds nothing relevant, the system should abstain.
    // We test the same path /api/knowledge/ask uses: pass the retrieved
    // context to a model and ask it to answer ONLY from that context.
    const block = results.map((r, i) => `[${i + 1}] ${r.content}`).join('\n');
    const { text } = await generateText({
      model: getLanguageModel('anthropic/claude-sonnet-4-6'),
      system: `You answer strictly from the knowledge base provided. If the knowledge does not directly contain the answer to the user's question, you MUST refuse with a sentence like "I don't have information about that." Do not infer, guess, or use general knowledge. Citing related-but-different information is forbidden.

## Knowledge Base:
${block}`,
      messages: [{ role: 'user', content: s.question }],
    });

    if (ABSTAIN_PHRASES.some((rx) => rx.test(text))) abstained++;
  }

  const precision = abstained / list.length;
  const out = { total: list.length, abstainPrecision: Number(precision.toFixed(4)) };
  console.log(JSON.stringify(out, null, 2));
  if (precision < 0.85) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
