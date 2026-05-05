import { config } from 'dotenv';
config({ path: '.env.local' });

import fs from 'node:fs/promises';
import path from 'node:path';

interface Scenario { id: string; v1: string; v2: string; question: string; expected_substring: string; }

async function main() {
  const { db } = await import('../../src/lib/db');
  const { organizations, users, sources, sourceChunks } = await import('../../src/lib/db/schema');
  const { ingestSource } = await import('../../src/lib/memory/ingest');
  const { retrieve } = await import('../../src/lib/memory/retrieve');
  const { withTenant } = await import('../../src/lib/db/tenant');
  const { sql, eq } = await import('drizzle-orm');

  const list = JSON.parse(await fs.readFile(path.resolve(process.cwd(), 'evals/knowledge-update/scenarios.json'), 'utf8')) as Scenario[];

  let hits = 0;
  for (const s of list) {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const [org] = await db.insert(organizations).values({ name: 'KU', slug: `ku-${stamp}` }).returning();
    const [u]   = await db.insert(users).values({ orgId: org.id, name: 'U', email: `ku-${stamp}@e.co`, role: 'member' }).returning();

    // Ingest v1 first, then backdate it 90 days so the recency boost
    // can break ties in favour of v2 (the current truth).
    const v1Source = await ingestSource({ orgId: org.id, type: 'document', ownerUserId: u.id, title: 'v1', chunks: [{ ord: 0, content: s.v1 }] });
    await withTenant(org.id, async (tx) => {
      await tx.execute(sql`UPDATE sources SET valid_at = NOW() - INTERVAL '90 days' WHERE id = ${v1Source}::uuid`);
      await tx.execute(sql`UPDATE source_chunks SET valid_at = NOW() - INTERVAL '90 days' WHERE source_id = ${v1Source}::uuid`);
    });
    await ingestSource({ orgId: org.id, type: 'document', ownerUserId: u.id, title: 'v2', chunks: [{ ord: 0, content: s.v2 }] });

    const r = await retrieve({
      query: s.question,
      scope: { userId: u.id, teamIds: [], orgId: org.id, includeOrg: true },
      topN: 3,
    });
    if (r[0]?.content.toLowerCase().includes(s.expected_substring.toLowerCase())) hits++;
  }

  const acc = hits / list.length;
  const out = { total: list.length, accuracy: Number(acc.toFixed(4)) };
  console.log(JSON.stringify(out, null, 2));
  if (acc < 0.65) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
