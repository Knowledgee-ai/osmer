import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../../src/lib/db');
  const { withTenant } = await import('../../src/lib/db/tenant');
  const { organizations, users } = await import('../../src/lib/db/schema');
  const { ingestSource } = await import('../../src/lib/memory/ingest');
  const { retrieve } = await import('../../src/lib/memory/retrieve');
  const { loadLongMemEvalSubset } = await import('./data');

  const limit = Number(process.env.LME_LIMIT ?? 50);
  const tasks = await loadLongMemEvalSubset(limit);

  const buckets: Record<string, { total: number; hits: number }> = {};
  let total = 0, hits = 0;

  for (const task of tasks) {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const [org]  = await db.insert(organizations).values({ name: 'lme', slug: `lme-${stamp}` }).returning();
    const [user] = await db.insert(users).values({ orgId: org.id, name: 'Tester', email: `lme-${stamp}@e.co`, role: 'member' }).returning();

    // Ingest each haystack session as a conversation source
    const goldSourceIds = new Set<string>();
    for (let s = 0; s < task.haystack_sessions.length; s++) {
      const session = task.haystack_sessions[s];
      const sourceId = await ingestSource({
        orgId: org.id,
        type: 'conversation',
        ownerUserId: user.id,
        title: `lme-session-${s}`,
        chunks: session.map((m, i) => ({
          ord: i,
          role: m.role,
          content: m.content,
          speakerUserId: m.role === 'user' ? user.id : null,
        })),
      });

      const sessionIdRaw = task.haystack_session_ids?.[s] ?? String(s);
      const goldIds = (task.answer_session_ids ?? []).map(String);
      if (goldIds.includes(String(sessionIdRaw))) {
        goldSourceIds.add(sourceId);
      }
    }

    // Retrieve top-5 for the question
    const r = await retrieve({
      query: task.question,
      scope: { userId: user.id, teamIds: [], orgId: org.id, includeOrg: true },
      topN: 5,
    });

    const hit = r.some((x) => goldSourceIds.has(x.sourceId));
    const bucket = (buckets[task.question_type] ??= { total: 0, hits: 0 });
    bucket.total++;
    total++;
    if (hit) { hits++; bucket.hits++; }

    if (total % 10 === 0) {
      console.error(`[lme] progress: ${total}/${tasks.length} — recall ${(hits/total).toFixed(3)}`);
    }
  }

  const recall = total > 0 ? hits / total : 0;
  const result = { total, recallAt5: Number(recall.toFixed(4)), byType: buckets };
  console.log(JSON.stringify(result, null, 2));
  if (recall < 0.65) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
