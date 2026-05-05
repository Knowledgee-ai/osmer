# M5 — Memory Map (2D + 3D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Render the company memory as a live, interactive graph — 2D force-directed in-app for daily navigation, 3D three.js hero for the homepage / login / admin dashboard. Same data model, two renderers. Topics, atoms, sources, entities, contributors are all node types; contributor sizing + filter-by-contributor + leaderboard turns memory growth into a visible, social asset.

**Architecture:** A daily snapshot job computes the graph from `source_chunks`, `memory_atoms`, `memory_entities`, `users`, and writes a JSON blob to `memory_snapshots`. The 2D renderer (react-force-graph) reads the snapshot + a "what changed today" diff. The 3D hero (react-three-fiber) renders the same data with depth, light, and slow rotation. Anonymous mode is an admin toggle that drops contributor names from rendered nodes.

**Tech Stack:** `react-force-graph-2d`, `react-force-graph-3d`, `react-three-fiber`, `three`, HDBSCAN port (`hdbscan-js` or our own kmeans++ fallback) for topic clustering, daily Vercel cron.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `src/lib/memory-map/types.ts` | `GraphNode`, `GraphEdge`, `Snapshot`, `ContributorWeight` |
| `src/lib/memory-map/snapshot.ts` | `computeSnapshot(orgId)` — pulls chunks/atoms/entities/users, builds nodes + edges + sizes |
| `src/lib/memory-map/cluster.ts` | Topic clustering helper (kmeans++ fallback; swap to HDBSCAN once Node binding is stable) |
| `src/lib/memory-map/diff.ts` | `diffSnapshots(prev, next)` — what nodes/edges grew/appeared since last snapshot |
| `src/app/api/memory/map/route.ts` | GET latest snapshot for the user's org (with anonymization applied) |
| `src/app/api/memory/contributors/route.ts` | GET contributor leaderboard (week/month) |
| `src/app/chat/map/page.tsx` | 2D Memory Map page |
| `src/components/memory-map/graph-2d.tsx` | 2D force-directed renderer with filters + search |
| `src/components/memory-map/graph-3d.tsx` | 3D hero renderer |
| `src/components/memory-map/contributor-panel.tsx` | Sidebar leaderboard |
| `src/components/memory-map/filters.tsx` | Type + contributor filters |
| `src/lib/memory-map/cron.ts` | `runMemoryMapSnapshot()` cron handler |

**Modified files:**

| Path | Change |
|---|---|
| `vercel.ts` | Add `/api/cron/memory-map` daily |
| `src/app/api/cron/[job]/route.ts` | Register `memory-map` handler |
| `src/app/page.tsx` | Replace landing hero with 3D Memory Map for authed visitors (or a sample dataset for anon) |

---

## Task 1: Snapshot computation

**Files:**
- Create: `src/lib/memory-map/types.ts`
- Create: `src/lib/memory-map/cluster.ts`
- Create: `src/lib/memory-map/snapshot.ts`

- [ ] **Step 1: Types**

```ts
export type NodeKind = 'topic' | 'atom' | 'source' | 'entity' | 'contributor';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  size: number;
  meta: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: 'backed_by' | 'about' | 'authored_by' | 'contains' | 'supersedes';
  weight: number;
}

export interface ContributorWeight {
  userId: string;
  name: string;
  score: number;          // sum of affirmed_count of atoms + chunk count weight
  weekDelta: number;
}

export interface Snapshot {
  orgId: string;
  computedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  contributorWeights: ContributorWeight[];
  topicClusters: Array<{ id: string; label: string; chunkIds: string[] }>;
}
```

- [ ] **Step 2: Cluster (kmeans++ fallback)**

```ts
// Lightweight kmeans++ over normalized embeddings. We can swap to HDBSCAN once a stable Node port is chosen.
export function kmeansPlusPlus(vectors: number[][], k: number): number[] {
  if (vectors.length === 0) return [];
  const n = vectors.length;
  const dim = vectors[0].length;
  // init: pick first center at random, then weighted picks by distance²
  const centers: number[][] = [vectors[Math.floor(Math.random() * n)]];
  while (centers.length < k) {
    const dists = vectors.map((v) => Math.min(...centers.map((c) => sqDist(v, c))));
    const total = dists.reduce((a, b) => a + b, 0);
    const pick = Math.random() * total;
    let acc = 0;
    for (let i = 0; i < n; i++) { acc += dists[i]; if (acc >= pick) { centers.push(vectors[i]); break; } }
  }
  // assign + iterate
  const assign = new Array(n).fill(0);
  for (let iter = 0; iter < 20; iter++) {
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = sqDist(vectors[i], centers[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      assign[i] = best;
    }
    for (let c = 0; c < centers.length; c++) {
      const members = vectors.filter((_, i) => assign[i] === c);
      if (members.length === 0) continue;
      const mean = new Array(dim).fill(0);
      for (const m of members) for (let d = 0; d < dim; d++) mean[d] += m[d];
      for (let d = 0; d < dim; d++) mean[d] /= members.length;
      centers[c] = mean;
    }
  }
  return assign;
}

function sqDist(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return s;
}
```

- [ ] **Step 3: Snapshot**

```ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { kmeansPlusPlus } from './cluster';
import type { Snapshot, GraphNode, GraphEdge } from './types';
import { generateText } from 'ai';
import { getLanguageModel } from '@/lib/ai/router';

export async function computeSnapshot(orgId: string): Promise<Snapshot> {
  // Pull active atoms + their backing chunks + entities + users (contributors)
  const atoms = await db.execute(sql`
    SELECT a.id, a.type, a.content, a.affirmed_count, a.scope_user_id, a.source_ids
    FROM memory_atoms a WHERE a.org_id = ${orgId} AND a.status = 'active'
  `);

  const chunkIdSet = new Set<string>();
  for (const a of atoms.rows as Array<{ source_ids: string[] }>) {
    for (const sid of (a.source_ids ?? [])) chunkIdSet.add(sid);
  }
  const chunkIds = Array.from(chunkIdSet);

  const chunks = chunkIds.length ? await db.execute(sql`
    SELECT id, source_id, content, speaker_user_id, embedding::text AS embedding
    FROM source_chunks WHERE id = ANY(${chunkIds}::uuid[])
  `) : { rows: [] as unknown[] };

  const sources = await db.execute(sql`SELECT id, type, title, owner_user_id FROM sources WHERE org_id = ${orgId} AND status = 'active'`);
  const entities = await db.execute(sql`SELECT id, name, type, mention_count FROM memory_entities WHERE org_id = ${orgId} ORDER BY mention_count DESC LIMIT 200`);
  const users = await db.execute(sql`SELECT id, name FROM users WHERE org_id = ${orgId}`);
  const links = await db.execute(sql`SELECT entity_id, chunk_id, atom_id FROM entity_links WHERE org_id = ${orgId}`);

  // Topic clusters: kmeans++ over chunk embeddings
  const vectors = (chunks.rows as Array<{ id: string; embedding: string }>)
    .map((r) => ({ id: r.id, vec: parseVec(r.embedding) }))
    .filter((r) => r.vec.length > 0);
  const k = Math.max(2, Math.min(20, Math.floor(Math.sqrt(vectors.length / 2))));
  const assign = vectors.length > k ? kmeansPlusPlus(vectors.map((v) => v.vec), k) : new Array(vectors.length).fill(0);

  const topicLabels = await Promise.all(Array.from(new Set(assign)).map(async (c) => {
    const memberContents = vectors.filter((_, i) => assign[i] === c).slice(0, 5).map((v) => v.id);
    // Cheap labeller: pick the first chunk and ask Haiku for a 3-word topic name
    const sample = memberContents[0];
    const sampleRow = (chunks.rows as Array<{ id: string; content: string }>).find((r) => r.id === sample);
    if (!sampleRow) return { c, label: `cluster-${c}` };
    const { text } = await generateText({
      model: getLanguageModel('anthropic/claude-haiku-4-5-20251001'),
      messages: [{ role: 'user', content: `Give a 2-4 word topic label for this:\n\n${sampleRow.content.slice(0, 500)}\n\nTopic:` }],
    });
    return { c, label: text.replace(/[^a-zA-Z0-9 ]/g, '').trim() || `cluster-${c}` };
  }));

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Topics
  for (const { c, label } of topicLabels) {
    const memberIds = vectors.filter((_, i) => assign[i] === c).map((v) => v.id);
    nodes.push({ id: `topic:${c}`, kind: 'topic', label, size: memberIds.length, meta: { chunkIds: memberIds } });
  }

  // Atoms
  for (const a of atoms.rows as Array<{ id: string; type: string; content: string; affirmed_count: number; scope_user_id: string | null; source_ids: string[] }>) {
    nodes.push({ id: `atom:${a.id}`, kind: 'atom', label: a.content.slice(0, 80), size: 1 + a.affirmed_count, meta: { type: a.type } });
    for (const sid of a.source_ids ?? []) edges.push({ source: `atom:${a.id}`, target: `chunk:${sid}`, kind: 'backed_by', weight: 1 });
  }

  // Sources
  for (const s of sources.rows as Array<{ id: string; type: string; title: string | null; owner_user_id: string | null }>) {
    nodes.push({ id: `source:${s.id}`, kind: 'source', label: s.title ?? s.type, size: 2, meta: { type: s.type } });
    if (s.owner_user_id) edges.push({ source: `source:${s.id}`, target: `user:${s.owner_user_id}`, kind: 'authored_by', weight: 1 });
  }

  // Entities
  for (const e of entities.rows as Array<{ id: string; name: string; type: string; mention_count: number }>) {
    nodes.push({ id: `entity:${e.id}`, kind: 'entity', label: e.name, size: 1 + Math.log10(1 + e.mention_count), meta: { type: e.type } });
  }
  for (const l of links.rows as Array<{ entity_id: string; chunk_id: string | null; atom_id: string | null }>) {
    if (l.atom_id) edges.push({ source: `atom:${l.atom_id}`, target: `entity:${l.entity_id}`, kind: 'about', weight: 1 });
  }

  // Contributors
  const contributorWeights = (users.rows as Array<{ id: string; name: string }>).map((u) => {
    const score = (atoms.rows as Array<{ scope_user_id: string | null; affirmed_count: number }>).filter((a) => a.scope_user_id === u.id).reduce((s, a) => s + a.affirmed_count, 0);
    return { userId: u.id, name: u.name, score, weekDelta: 0 };
  }).filter((c) => c.score > 0).sort((a, b) => b.score - a.score);

  for (const c of contributorWeights) nodes.push({ id: `user:${c.userId}`, kind: 'contributor', label: c.name, size: 2 + Math.log10(1 + c.score), meta: {} });

  return {
    orgId, computedAt: new Date().toISOString(),
    nodes, edges,
    contributorWeights,
    topicClusters: topicLabels.map(({ c, label }) => ({ id: `topic:${c}`, label, chunkIds: vectors.filter((_, i) => assign[i] === c).map((v) => v.id) })),
  };
}

function parseVec(s: string | null): number[] {
  if (!s) return [];
  if (s.startsWith('[')) return JSON.parse(s);
  // Postgres vector format: '[v1,v2,...]'
  return [];
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/memory-map/
git commit -m "feat(map): snapshot computation — clusters + atoms + sources + entities + contributors"
```

---

## Task 2: Snapshot cron

**Files:**
- Create: `src/lib/memory-map/cron.ts`
- Modify: `vercel.ts`
- Modify: `src/app/api/cron/[job]/route.ts`

- [ ] **Step 1: Cron handler**

```ts
import { db } from '@/lib/db';
import { organizations, memorySnapshots } from '@/lib/db/schema';
import { computeSnapshot } from './snapshot';

export async function runMemoryMapSnapshot() {
  const orgs = await db.select({ id: organizations.id }).from(organizations);
  let written = 0;
  for (const o of orgs) {
    const snap = await computeSnapshot(o.id);
    await db.insert(memorySnapshots).values({
      orgId: o.id,
      nodes: snap.nodes, edges: snap.edges,
      contributorWeights: snap.contributorWeights, topicClusters: snap.topicClusters,
    });
    written++;
  }
  return { snapshots: written };
}
```

- [ ] **Step 2: Wire into cron route**

```ts
import { runMemoryMapSnapshot } from '@/lib/memory-map/cron';
HANDLERS['memory-map'] = runMemoryMapSnapshot;
```

`vercel.ts`:

```ts
{ path: '/api/cron/memory-map', schedule: '0 5 * * *' },  // daily 05:00 UTC
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/memory-map/cron.ts src/app/api/cron/[job]/route.ts vercel.ts
git commit -m "feat(map): daily snapshot cron"
```

---

## Task 3: Snapshot API

**Files:**
- Create: `src/app/api/memory/map/route.ts`
- Create: `src/app/api/memory/contributors/route.ts`

- [ ] **Step 1: Map endpoint**

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, memorySnapshots, organizations } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  // Fetch latest snapshot
  const [snap] = await db.select().from(memorySnapshots).where(eq(memorySnapshots.orgId, me.orgId)).orderBy(desc(memorySnapshots.computedAt)).limit(1);
  if (!snap) return Response.json({ error: 'no_snapshot' }, { status: 404 });

  // Anonymous mode?
  const [org] = await db.select().from(organizations).where(eq(organizations.id, me.orgId));
  const anon = ((org?.settings ?? {}) as Record<string, unknown>).memoryMapAnonymous === true;

  let nodes = snap.nodes as Array<{ id: string; kind: string; label: string; size: number; meta: Record<string, unknown> }>;
  if (anon) {
    nodes = nodes.map((n) => n.kind === 'contributor' ? { ...n, label: 'Contributor' } : n);
  }
  return Response.json({ snapshot: { ...snap, nodes } });
}
```

- [ ] **Step 2: Contributors endpoint**

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, memorySnapshots } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });
  const [snap] = await db.select().from(memorySnapshots).where(eq(memorySnapshots.orgId, me.orgId)).orderBy(desc(memorySnapshots.computedAt)).limit(1);
  return Response.json({ contributors: snap?.contributorWeights ?? [] });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/memory/
git commit -m "feat(map): snapshot + contributors API endpoints"
```

---

## Task 4: 2D in-app graph

**Files:**
- Create: `src/components/memory-map/graph-2d.tsx`
- Create: `src/components/memory-map/filters.tsx`
- Create: `src/components/memory-map/contributor-panel.tsx`
- Create: `src/app/chat/map/page.tsx`

- [ ] **Step 1: Install deps**

```bash
npm install react-force-graph-2d react-force-graph-3d three
```

- [ ] **Step 2: 2D graph**

```tsx
'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const COLOR_BY_KIND: Record<string, string> = {
  topic: '#7b6043',
  atom: '#2d2a26',
  source: '#a89c8a',
  entity: '#c2683f',
  contributor: '#3f6f47',
};

export function Graph2D() {
  const [data, setData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [filterKinds, setFilterKinds] = useState<Set<string>>(new Set(['topic', 'atom', 'entity', 'contributor']));
  const [filterContributor, setFilterContributor] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/memory/map').then((r) => r.json()).then((j) => {
      const nodes = (j.snapshot?.nodes ?? []).filter((n: any) => filterKinds.has(n.kind));
      const links = (j.snapshot?.edges ?? []).filter((e: any) => nodes.find((n: any) => n.id === e.source) && nodes.find((n: any) => n.id === e.target));
      setData({ nodes, links });
    });
  }, [filterKinds]);

  return (
    <ForceGraph2D
      graphData={data}
      nodeLabel={(n: any) => `${n.kind}: ${n.label}`}
      nodeColor={(n: any) => COLOR_BY_KIND[n.kind] ?? '#888'}
      nodeVal={(n: any) => filterContributor && (n.kind === 'contributor' && n.id !== filterContributor) ? 0.3 : n.size}
      linkColor={() => 'rgba(0,0,0,0.15)'}
      backgroundColor="rgba(0,0,0,0)"
      cooldownTicks={150}
      onNodeClick={(n: any) => {
        if (n.kind === 'contributor') setFilterContributor(n.id === filterContributor ? null : n.id);
        if (n.kind === 'source') window.location.href = `/chat/${n.id.replace('source:', '')}`;
      }}
    />
  );
}
```

- [ ] **Step 3: Filters + contributor panel**

```tsx
// filters.tsx
'use client';
import type { Dispatch, SetStateAction } from 'react';

const KINDS = ['topic', 'atom', 'source', 'entity', 'contributor'] as const;

export function Filters({ value, setValue }: { value: Set<string>; setValue: Dispatch<SetStateAction<Set<string>>> }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {KINDS.map((k) => (
        <button
          key={k}
          onClick={() => setValue((s) => { const next = new Set(s); if (next.has(k)) next.delete(k); else next.add(k); return next; })}
          className={`text-xs px-2 py-1 rounded ${value.has(k) ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-700'}`}
        >{k}</button>
      ))}
    </div>
  );
}
```

```tsx
// contributor-panel.tsx
'use client';
import { useEffect, useState } from 'react';

interface C { userId: string; name: string; score: number; }

export function ContributorPanel({ onSelect }: { onSelect?: (id: string) => void }) {
  const [list, setList] = useState<C[]>([]);
  useEffect(() => { fetch('/api/memory/contributors').then((r) => r.json()).then((j) => setList(j.contributors ?? [])); }, []);
  return (
    <ul className="space-y-1 text-sm">
      {list.slice(0, 10).map((c) => (
        <li key={c.userId} className="flex items-center gap-2">
          <button onClick={() => onSelect?.(c.userId)} className="flex-1 text-left hover:underline">{c.name}</button>
          <span className="text-xs text-stone-500">{c.score}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Page**

```tsx
import { Graph2D } from '@/components/memory-map/graph-2d';
import { ContributorPanel } from '@/components/memory-map/contributor-panel';

export default function MapPage() {
  return (
    <div className="grid grid-cols-[1fr_280px] h-screen">
      <div className="relative"><Graph2D /></div>
      <aside className="border-l p-4 overflow-y-auto">
        <h2 className="text-xs uppercase tracking-wide text-stone-500 mb-3">Top contributors</h2>
        <ContributorPanel />
      </aside>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/memory-map/ src/app/chat/map/ package.json package-lock.json
git commit -m "feat(map): 2D in-app force-directed graph + contributor panel"
```

---

## Task 5: 3D hero

**Files:**
- Create: `src/components/memory-map/graph-3d.tsx`

- [ ] **Step 1: Component**

```tsx
'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

export function Graph3D({ src = '/api/memory/map' }: { src?: string }) {
  const [data, setData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const ref = useRef<any>(null);

  useEffect(() => {
    fetch(src).then((r) => r.ok ? r.json() : null).then((j) => {
      if (!j?.snapshot) return;
      setData({ nodes: j.snapshot.nodes, links: j.snapshot.edges });
    });
  }, [src]);

  useEffect(() => {
    if (ref.current) {
      // Slow auto-rotation: orbit camera over time
      let angle = 0;
      const id = setInterval(() => {
        angle += 0.002;
        const dist = 600;
        ref.current?.cameraPosition({ x: dist * Math.cos(angle), y: 80, z: dist * Math.sin(angle) }, { x: 0, y: 0, z: 0 }, 1200);
      }, 50);
      return () => clearInterval(id);
    }
  }, [ref.current]);

  return (
    <ForceGraph3D
      ref={ref}
      graphData={data}
      nodeLabel={(n: any) => n.label}
      nodeColor={(n: any) => ({ topic: '#c2683f', atom: '#fafaf7', source: '#a89c8a', entity: '#7b6043', contributor: '#3f6f47' } as Record<string, string>)[n.kind] ?? '#888'}
      nodeVal={(n: any) => n.size}
      linkOpacity={0.15}
      backgroundColor="rgba(8,8,8,0)"
      enableNodeDrag={false}
      enableNavigationControls={false}
      showNavInfo={false}
    />
  );
}
```

- [ ] **Step 2: Wire into landing page**

In `src/app/page.tsx`, replace whatever currently renders the hero illustration with `<Graph3D src="/api/memory/map/sample" />` for unauthed (a sample dataset endpoint to be added in M8); for authed users `<Graph3D />`.

- [ ] **Step 3: Commit**

```bash
git add src/components/memory-map/graph-3d.tsx src/app/page.tsx
git commit -m "feat(map): 3D hero — slow-rotating three.js renderer"
```

---

## Task 6: Anonymous-mode admin toggle + acceptance

**Files:**
- Modify: `src/components/settings/settings-dialog.tsx`
- Create: `src/app/api/admin/memory-map/anonymous/route.ts`
- Create: `docs/specs/M5-results.md`

- [ ] **Step 1: Toggle endpoint**

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, organizations } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const [me] = await db.select({ orgId: users.orgId, role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId || (me.role !== 'admin' && me.role !== 'owner')) return Response.json({ error: 'forbidden' }, { status: 403 });
  const { anonymous } = await req.json() as { anonymous: boolean };
  await db.execute(sql`UPDATE organizations SET settings = settings || jsonb_build_object('memoryMapAnonymous', ${anonymous}) WHERE id = ${me.orgId}`);
  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Add toggle to settings dialog**

Add a section in `settings-dialog.tsx` calling the endpoint above (admin-only).

- [ ] **Step 3: Results**

```markdown
# M5 — Results

| Gate | Result |
|---|---|
| 2D map renders nodes + edges within 2s of page load | |
| 3D hero animates smoothly at 60fps on a baseline laptop | |
| Filter by contributor lights up only their footprint | |
| Anonymous mode hides contributor names | |
| Daily snapshot cron writes a row in memory_snapshots | |
| Click a source node → opens that source / conversation | |
```

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/ src/app/api/admin/ docs/specs/M5-results.md
git commit -m "feat(map): anonymous-mode admin toggle + acceptance template"
```

---

## Self-review

- 2D + 3D graph from one snapshot ✓
- Topic / atom / source / entity / contributor nodes ✓
- Edges ✓
- Contributor sizing + leaderboard + filter ✓
- Anonymous mode ✓
- Daily snapshot ✓
- Click-through navigation ✓

**Deferred:** "What changed today" overlay (compare to previous snapshot, color new/grown nodes), HDBSCAN swap, search box, focus-on-node detail panel, public-share-a-graph (cut from scope).
