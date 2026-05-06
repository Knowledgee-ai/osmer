'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

interface SnapNode { id: string; kind: string; label: string; size: number; meta: Record<string, unknown>; }
interface SnapEdge { source: string; target: string; kind: string; weight: number; }

const COLOR: Record<string, string> = {
  topic:       '#c2683f',
  atom:        '#fafaf7',
  source:      '#a89c8a',
  entity:      '#7b6043',
  contributor: '#3f6f47',
};

interface Props {
  src?: string;
  background?: string;
}

export function Graph3D({ src = '/api/memory/map', background = 'rgba(8,8,8,0)' }: Props) {
  const [data, setData] = useState<{ nodes: SnapNode[]; links: SnapEdge[] } | null>(null);
  // react-force-graph's ref expects its full ForceGraphMethods type;
  // we only call cameraPosition. Use any here so we don't pull every
  // method signature into our component just for this one call.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    fetch(src)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.snapshot) return;
        setData({ nodes: j.snapshot.nodes ?? [], links: j.snapshot.edges ?? [] });
      })
      .catch(() => { /* leave empty */ });
  }, [src]);

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

  // Slow camera orbit; pure visual.
  useEffect(() => {
    if (!ref.current) return;
    let angle = 0;
    const dist = 600;
    const id = setInterval(() => {
      angle += 0.0025;
      ref.current?.cameraPosition(
        { x: dist * Math.cos(angle), y: 80, z: dist * Math.sin(angle) },
        { x: 0, y: 0, z: 0 },
        1500,
      );
    }, 60);
    return () => clearInterval(id);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      {data && size.w > 0 ? (
        <ForceGraph3D
          ref={ref}
          width={size.w}
          height={size.h}
          graphData={data}
          nodeId="id"
          nodeLabel={(n: object) => (n as SnapNode).label}
          nodeColor={(n: object) => COLOR[(n as SnapNode).kind] ?? '#888'}
          nodeVal={(n: object) => (n as SnapNode).size}
          linkColor={() => 'rgba(180,180,180,0.18)'}
          linkOpacity={0.18}
          backgroundColor={background}
          enableNodeDrag={false}
          enableNavigationControls={false}
          showNavInfo={false}
        />
      ) : null}
    </div>
  );
}
