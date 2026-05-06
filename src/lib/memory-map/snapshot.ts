import { sql } from 'drizzle-orm';
import { generateText } from 'ai';
import { withTenant } from '@/lib/db/tenant';
import { getLanguageModel } from '@/lib/ai/router';
import { kmeansPlusPlus } from './cluster';
import type { Snapshot, GraphNode, GraphEdge, ContributorWeight, TopicCluster } from './types';

const TOPIC_LABEL_MODEL = process.env.TOPIC_LABEL_MODEL ?? 'anthropic/claude-haiku-4-5-20251001';

/**
 * Compute a Memory Map snapshot for an org.
 *
 *  - Topics: kmeans++ over chunk embeddings; k = sqrt(n/2), bounded [2,20].
 *  - Atoms: active memory_atoms, sized by affirmed_count.
 *  - Sources: of-substance documents/conversations/interviews.
 *  - Entities: top-200 by mention_count.
 *  - Contributors: users whose authored sources back atoms.
 *
 * Edges:
 *  - atom → backed_by → chunk-source
 *  - atom → about → entity (via entity_links)
 *  - source → authored_by → contributor
 *  - topic → contains → atom
 *
 * Returns a Snapshot ready to JSON-serialize into memory_snapshots.
 */
export async function computeSnapshot(orgId: string): Promise<Snapshot> {
  return withTenant(orgId, async (tx) => {
    // 1. Active atoms
    const atomsR = await tx.execute(sql`
      SELECT id, type, content, affirmed_count, scope_user_id, source_ids
      FROM memory_atoms
      WHERE status = 'active'
      ORDER BY affirmed_count DESC
      LIMIT 500
    `);
    const atoms = atomsR.rows as Array<{
      id: string; type: string; content: string;
      affirmed_count: number; scope_user_id: string | null;
      source_ids: string[];
    }>;

    // 2. Pull backing chunks (text + embedding) for clustering
    const chunkIdSet = new Set<string>();
    for (const a of atoms) for (const sid of a.source_ids ?? []) chunkIdSet.add(sid);
    const chunkIds = Array.from(chunkIdSet);

    const chunksR = chunkIds.length === 0
      ? { rows: [] as Array<{ id: string; content: string; source_id: string; embedding: string | null }> }
      : await tx.execute(sql`
          SELECT id, content, source_id, embedding::text AS embedding
          FROM source_chunks
          WHERE id = ANY(${chunkIds}::uuid[])
            AND embedding IS NOT NULL
        `);
    const chunks = chunksR.rows as Array<{ id: string; content: string; source_id: string; embedding: string | null }>;

    // 3. Cluster chunk embeddings into topics
    const vectors = chunks.map((c) => parseVec(c.embedding)).filter((v) => v.length > 0);
    const k = Math.max(2, Math.min(20, Math.floor(Math.sqrt(vectors.length / 2))));
    const assign = vectors.length > k ? kmeansPlusPlus(vectors, k) : new Array(vectors.length).fill(0);

    // 4. Label each cluster (Haiku-class)
    const uniqClusters = Array.from(new Set(assign));
    const topicLabels = await Promise.all(uniqClusters.map(async (c) => {
      const memberIdx = assign.flatMap((a, i) => (a === c ? [i] : []));
      const sample = memberIdx[0];
      if (sample == null || !chunks[sample]) return { c, label: `Topic ${c + 1}` };
      try {
        const { text } = await generateText({
          model: getLanguageModel(TOPIC_LABEL_MODEL),
          messages: [{
            role: 'user',
            content: `In 2-4 words, give a topic label for this passage. Reply with ONLY the label — no quotes, no preamble.

Passage:
${chunks[sample].content.slice(0, 800)}

Topic:`,
          }],
        });
        const label = text.replace(/[^a-zA-Z0-9 &/-]/g, '').trim().slice(0, 40);
        return { c, label: label || `Topic ${c + 1}` };
      } catch {
        return { c, label: `Topic ${c + 1}` };
      }
    }));
    const topicLabelMap = new Map(topicLabels.map(({ c, label }) => [c, label]));

    // 5. Sources, entities, users (and entity links)
    const sourcesR = await tx.execute(sql`
      SELECT id, type, title, owner_user_id
      FROM sources
      WHERE status = 'active'
      ORDER BY created_at DESC
      LIMIT 300
    `);
    const entitiesR = await tx.execute(sql`
      SELECT id, name, type, mention_count
      FROM memory_entities
      ORDER BY mention_count DESC
      LIMIT 200
    `);
    const usersR = await tx.execute(sql`SELECT id, name FROM users WHERE org_id = current_setting('app.current_org_id', true)::uuid`);
    const linksR = await tx.execute(sql`SELECT entity_id, atom_id FROM entity_links WHERE atom_id IS NOT NULL`);

    // 6. Build nodes + edges
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Topics
    const topicClusters: TopicCluster[] = [];
    for (const c of uniqClusters) {
      const memberChunkIds = chunks.filter((_, i) => assign[i] === c).map((ch) => ch.id);
      const id = `topic:${c}`;
      const label = topicLabelMap.get(c) ?? `Topic ${c + 1}`;
      nodes.push({ id, kind: 'topic', label, size: 4 + Math.log2(1 + memberChunkIds.length) * 2, meta: {} });
      topicClusters.push({ id, label, chunkIds: memberChunkIds });
    }

    // Build chunkId → topicId map for atom-topic edges
    const chunkTopic = new Map<string, string>();
    chunks.forEach((ch, i) => chunkTopic.set(ch.id, `topic:${assign[i] ?? 0}`));

    // Atoms (and topic edges)
    for (const a of atoms) {
      const id = `atom:${a.id}`;
      nodes.push({
        id,
        kind: 'atom',
        label: a.content.slice(0, 80),
        size: 1.5 + Math.log2(1 + a.affirmed_count),
        meta: { type: a.type, affirmed: a.affirmed_count },
      });

      const topicsHit = new Set<string>();
      for (const sid of a.source_ids ?? []) {
        const t = chunkTopic.get(sid);
        if (t) topicsHit.add(t);
      }
      for (const t of topicsHit) {
        edges.push({ source: t, target: id, kind: 'contains', weight: 1 });
      }
    }

    // Sources + authored_by edges
    for (const s of sourcesR.rows as Array<{ id: string; type: string; title: string | null; owner_user_id: string | null }>) {
      nodes.push({
        id: `source:${s.id}`,
        kind: 'source',
        label: s.title ?? s.type,
        size: 2,
        meta: { type: s.type },
      });
      if (s.owner_user_id) {
        edges.push({ source: `source:${s.id}`, target: `user:${s.owner_user_id}`, kind: 'authored_by', weight: 1 });
      }
    }

    // Entities
    for (const e of entitiesR.rows as Array<{ id: string; name: string; type: string; mention_count: number }>) {
      nodes.push({
        id: `entity:${e.id}`,
        kind: 'entity',
        label: e.name,
        size: 1.5 + Math.log10(1 + e.mention_count),
        meta: { type: e.type },
      });
    }
    for (const l of linksR.rows as Array<{ entity_id: string; atom_id: string | null }>) {
      if (l.atom_id) edges.push({ source: `atom:${l.atom_id}`, target: `entity:${l.entity_id}`, kind: 'about', weight: 1 });
    }

    // Contributors (only those who authored at least one source backing an active atom)
    const contributorWeights: ContributorWeight[] = [];
    const userMap = new Map<string, string>();
    for (const u of usersR.rows as Array<{ id: string; name: string }>) userMap.set(u.id, u.name);

    const userScores = new Map<string, number>();
    for (const a of atoms) {
      if (!a.scope_user_id) continue;
      userScores.set(a.scope_user_id, (userScores.get(a.scope_user_id) ?? 0) + a.affirmed_count);
    }

    for (const [userId, score] of userScores) {
      const name = userMap.get(userId);
      if (!name) continue;
      contributorWeights.push({ userId, name, score, weekDelta: 0 });
    }
    contributorWeights.sort((a, b) => b.score - a.score);

    for (const c of contributorWeights) {
      nodes.push({
        id: `user:${c.userId}`,
        kind: 'contributor',
        label: c.name,
        size: 2 + Math.log2(1 + c.score),
        meta: {},
      });
    }

    return {
      orgId,
      computedAt: new Date().toISOString(),
      nodes,
      edges,
      contributorWeights,
      topicClusters,
    };
  });
}

/**
 * Postgres returns vector(1536) as a string like "[0.1,0.2,...]" or
 * (when cast to text via ::text) the same shape. We accept both.
 */
function parseVec(s: string | null): number[] {
  if (!s) return [];
  if (s.startsWith('[') && s.endsWith(']')) {
    try { return JSON.parse(s); } catch { return []; }
  }
  return [];
}
