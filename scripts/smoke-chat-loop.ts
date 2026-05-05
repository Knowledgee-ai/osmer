/**
 * End-to-end smoke test of the chat → memory loop, using an existing
 * production user. Replicates exactly what /api/chat does on a turn:
 *   1. retrieve() against the user's org → fetches relevant chunks
 *   2. ingestSource() upserts the conversation + writes both chunks
 *   3. retrieve() the same query post-ingest → confirms the new chunk
 *      surfaces in subsequent context.
 *
 * Uses the owner connection only to look up an existing user; all
 * memory operations go through the normal app role under withTenant.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws as never;

async function main() {
  const ownerPool = new Pool({ connectionString: process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL });
  let user: { id: string; orgId: string; email: string };
  try {
    const r = await ownerPool.query(`
      SELECT id, org_id, email FROM users
      WHERE org_id IS NOT NULL
        AND email NOT LIKE 'lme-%' AND email NOT LIKE 'rls-%' AND email NOT LIKE 'r-%'
        AND email NOT LIKE 'cu-%' AND email NOT LIKE 'sem-%' AND email NOT LIKE 'lex-%'
        AND email NOT LIKE 'u-%@e.co' AND email NOT LIKE 'e-%@e.co'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    if (r.rows.length === 0) throw new Error('no real user in DB');
    user = r.rows[0] as { id: string; org_id: string; email: string } as never;
    user = { id: r.rows[0].id, orgId: r.rows[0].org_id, email: r.rows[0].email };
  } finally {
    await ownerPool.end();
  }
  console.log(`Using user ${user.email} (org=${user.orgId})`);

  const { ingestSource } = await import('../src/lib/memory/ingest');
  const { retrieve } = await import('../src/lib/memory/retrieve');

  const stamp = Math.floor(Date.now() / 1000);
  const conversationId = crypto.randomUUID();
  const userMsg = `Smoke ${stamp}: Acme Industries just signed a contract worth $${Math.floor(Math.random() * 900 + 100)}k for the platform integration.`;
  const assistantMsg = `Confirmed — recording the Acme Industries deal at that contract value.`;

  console.log('\n[1] Pre-ingest retrieval (should miss the smoke message)…');
  const before = await retrieve({
    query: `Acme Industries Smoke ${stamp}`,
    scope: { userId: user.id, teamIds: [], orgId: user.orgId, includeOrg: true },
    topN: 5,
  });
  const beforeHit = before.find((r) => r.content.includes(`Smoke ${stamp}`));
  console.log(`  pre-ingest hit: ${beforeHit ? 'FOUND (unexpected)' : 'none (expected)'}`);

  console.log('\n[2] Ingesting (user, assistant) turn pair…');
  const sourceId = await ingestSource({
    sourceId: conversationId,
    orgId: user.orgId,
    type: 'conversation',
    ownerUserId: user.id,
    chunks: [
      { ord: stamp,     role: 'user',      speakerUserId: user.id, content: userMsg },
      { ord: stamp + 1, role: 'assistant', speakerUserId: null,    content: assistantMsg },
    ],
  });
  console.log(`  source id: ${sourceId}`);

  console.log('\n[3] Post-ingest retrieval (should hit the user turn)…');
  const after = await retrieve({
    query: `Acme Industries Smoke ${stamp}`,
    scope: { userId: user.id, teamIds: [], orgId: user.orgId, includeOrg: true },
    topN: 5,
  });
  const afterHit = after.find((r) => r.content.includes(`Smoke ${stamp}`));
  if (!afterHit) {
    console.error('  POST-INGEST MISS — pipeline broken');
    process.exit(1);
  }
  console.log(`  hit @ score ${afterHit.finalScore.toFixed(3)}, signals: ${afterHit.signals.map((s) => s.kind).join(',')}`);
  console.log(`  content: "${afterHit.content.slice(0, 80)}…"`);

  console.log('\n[smoke] PASSED — chat → ingest → retrieval loop is healthy.');
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
