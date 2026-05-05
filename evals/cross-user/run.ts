import { config } from 'dotenv';
config({ path: '.env.local' });

import fs from 'node:fs/promises';
import path from 'node:path';

interface Scenario {
  id: string;
  industry: string;
  user_a_sessions: Array<Array<{ role: 'user' | 'assistant'; content: string }>>;
  user_b_question: string;
  expected_keywords: string[];
}

async function main() {
  const { db } = await import('../../src/lib/db');
  const { organizations, users } = await import('../../src/lib/db/schema');
  const { ingestSource } = await import('../../src/lib/memory/ingest');
  const { retrieve } = await import('../../src/lib/memory/retrieve');

  const raw = await fs.readFile(path.resolve(process.cwd(), 'evals/cross-user/scenarios.json'), 'utf8');
  const scenarios = JSON.parse(raw) as Scenario[];

  let hits = 0;
  const byIndustry: Record<string, { total: number; hits: number }> = {};

  for (const s of scenarios) {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const [org]   = await db.insert(organizations).values({ name: 'CU', slug: `cu-${stamp}` }).returning();
    const [userA] = await db.insert(users).values({ orgId: org.id, name: 'A', email: `cu-a-${stamp}@e.co`, role: 'member' }).returning();
    const [userB] = await db.insert(users).values({ orgId: org.id, name: 'B', email: `cu-b-${stamp}@e.co`, role: 'member' }).returning();

    for (const session of s.user_a_sessions) {
      await ingestSource({
        orgId: org.id,
        type: 'conversation',
        ownerUserId: userA.id,
        title: 'A',
        chunks: session.map((m, i) => ({
          ord: i,
          role: m.role,
          content: m.content,
          speakerUserId: m.role === 'user' ? userA.id : null,
        })),
      });
    }

    const r = await retrieve({
      query: s.user_b_question,
      scope: { userId: userB.id, teamIds: [], orgId: org.id, includeOrg: true },
      topN: 5,
    });

    const merged = r.map((x) => x.content.toLowerCase()).join(' ');
    const ok = s.expected_keywords.some((k) => merged.includes(k.toLowerCase()));

    const bucket = (byIndustry[s.industry] ??= { total: 0, hits: 0 });
    bucket.total++;
    if (ok) { hits++; bucket.hits++; }
  }

  const recall = hits / scenarios.length;
  const out = { total: scenarios.length, recall: Number(recall.toFixed(4)), byIndustry };
  console.log(JSON.stringify(out, null, 2));
  if (recall < 0.65) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
