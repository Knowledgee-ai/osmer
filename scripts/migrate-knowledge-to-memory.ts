import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/lib/db');
  const { withTenant } = await import('../src/lib/db/tenant');
  const { sources, sourceChunks, memoryAtoms } = await import('../src/lib/db/schema');
  const { embed } = await import('../src/lib/memory/embed');
  const { sql } = await import('drizzle-orm');

  // Pull legacy atoms; if org_id is null (V0 data), backfill from
  // users.org_id via scope_id (which holds the owning user_id).
  const legacy = await db.execute(sql`
    SELECT a.id, COALESCE(a.org_id, u.org_id) AS org_id,
           a.scope_id, a.type, a.content, a.confidence,
           a.topics, a.structured, a.source_conversation_id, a.source_user_id,
           a.created_at, a.last_affirmed, a.affirmed_count
    FROM knowledge_atoms a
    LEFT JOIN users u ON u.id = a.scope_id
    WHERE a.status = 'active'
  `);

  let migrated = 0, skipped = 0;
  for (const row of legacy.rows as Array<Record<string, unknown>>) {
    const orgId = row.org_id as string | null;
    if (!orgId) { skipped++; continue; }

    try {
      await withTenant(orgId, async (tx) => {
        const [src] = await tx.insert(sources).values({
          orgId,
          ownerUserId: (row.source_user_id as string | null) ?? null,
          type: 'document',
          title: 'Migrated atom',
          meta: { legacyAtomId: row.id, structured: row.structured },
        }).returning({ id: sources.id });

        const { vector } = await embed(row.content as string);
        const vecLit = JSON.stringify(vector);

        const [chunk] = await tx.insert(sourceChunks).values({
          sourceId: src.id,
          orgId,
          ord: 0,
          role: null,
          speakerUserId: (row.source_user_id as string | null) ?? null,
          content: row.content as string,
          tokenCount: Math.ceil((row.content as string).length / 4),
          embeddingVersion: 1,
        }).returning({ id: sourceChunks.id });
        await tx.execute(sql`UPDATE source_chunks SET embedding = ${vecLit}::vector WHERE id = ${chunk.id}`);

        const t = row.type as string;
        const collapsedType = t === 'fact' ? 'fact'
          : t === 'decision' ? 'decision'
          : t === 'preference' ? 'preference'
          : 'fact';

        const [atom] = await tx.insert(memoryAtoms).values({
          orgId,
          scopeUserId: (row.scope_id as string) ?? null,
          type: collapsedType,
          content: row.content as string,
          confidence: (row.confidence as number) ?? 0.7,
          affirmedCount: (row.affirmed_count as number) ?? 1,
          lastAffirmed: row.last_affirmed ? new Date(row.last_affirmed as string) : new Date(),
          status: 'active',
          sourceIds: [chunk.id],
          topics: (row.topics as string[]) ?? [],
        }).returning({ id: memoryAtoms.id });
        await tx.execute(sql`UPDATE memory_atoms SET embedding = ${vecLit}::vector WHERE id = ${atom.id}`);
      });
      migrated++;
      if (migrated % 25 === 0) console.log(`  migrated ${migrated} so far…`);
    } catch (err) {
      console.error(`  failed atom ${row.id}:`, err instanceof Error ? err.message : err);
      skipped++;
    }
  }

  console.log(`done: ${migrated} migrated, ${skipped} skipped`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
