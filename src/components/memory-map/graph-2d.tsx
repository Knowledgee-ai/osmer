'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface SnapNode { id: string; kind: string; label: string; size: number; meta: Record<string, unknown>; }
interface SnapEdge { source: string; target: string; kind: string; weight: number; }
interface Snapshot { nodes: SnapNode[]; edges: SnapEdge[]; }

interface GraphNode extends SnapNode { x?: number; y?: number; }

const COLOR: Record<string, string> = {
  topic:       '#7b6043',
  atom:        '#2d2a26',
  source:      '#a89c8a',
  entity:      '#c2683f',
  contributor: '#3f6f47',
};

interface Props {
  filterKinds: Set<string>;
  selectedContributor: string | null;
}

export function Graph2D({ filterKinds, selectedContributor }: Props) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    fetch('/api/memory/map')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => setData(j.snapshot))
      .catch((s) => setError(typeof s === 'number' && s === 404 ? 'No snapshot yet.' : 'Could not load map.'));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    const nodes = data.nodes.filter((n) => filterKinds.has(n.kind));
    const ids = new Set(nodes.map((n) => n.id));
    const links = data.edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));
    return { nodes, links };
  }, [data, filterKinds]);

  const dimContributorMode = !!selectedContributor;
  const reachableIds = useMemo(() => {
    if (!selectedContributor || !data) return null;
    const r = new Set<string>([selectedContributor]);
    // 1-hop reachability — any node connected to the selected contributor.
    for (const e of data.edges) {
      if (e.source === selectedContributor) r.add(typeof e.target === 'string' ? e.target : (e.target as { id: string }).id);
      if (e.target === selectedContributor) r.add(typeof e.source === 'string' ? e.source : (e.source as { id: string }).id);
    }
    return r;
  }, [selectedContributor, data]);

  if (error) return <div className="p-12 text-sm text-stone-500">{error}</div>;
  if (!data) return <div className="p-12 text-sm text-stone-500">Loading map…</div>;

  return (
    <div ref={containerRef} className="w-full h-full">
      {size.w > 0 && size.h > 0 ? (
        <ForceGraph2D
          width={size.w}
          height={size.h}
          graphData={filtered}
          nodeId="id"
          nodeLabel={(n: object) => `${(n as GraphNode).kind}: ${(n as GraphNode).label}`}
          nodeVal={(n: object) => {
            const node = n as GraphNode;
            if (dimContributorMode && reachableIds && !reachableIds.has(node.id)) return 0.4;
            return node.size;
          }}
          nodeColor={(n: object) => {
            const node = n as GraphNode;
            const base = COLOR[node.kind] ?? '#888';
            if (dimContributorMode && reachableIds && !reachableIds.has(node.id)) return `${base}33`;
            return base;
          }}
          linkColor={() => 'rgba(0,0,0,0.12)'}
          linkWidth={0.5}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={150}
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={(n: object, ctx: CanvasRenderingContext2D, scale: number) => {
            const node = n as GraphNode;
            if (scale < 1.6) return;
            const dim = dimContributorMode && reachableIds && !reachableIds.has(node.id);
            ctx.font = `${10 / scale}px sans-serif`;
            ctx.fillStyle = dim ? 'rgba(60,60,60,0.4)' : 'rgba(40,40,40,0.95)';
            ctx.textAlign = 'left';
            ctx.fillText(node.label.slice(0, 32), (node.x ?? 0) + node.size * 0.7, (node.y ?? 0) + 2);
          }}
          onNodeClick={(n: object) => {
            const node = n as GraphNode;
            if (node.kind === 'source') {
              const id = node.id.replace(/^source:/, '');
              window.location.href = `/chat/${id}`;
            }
          }}
        />
      ) : null}
    </div>
  );
}
