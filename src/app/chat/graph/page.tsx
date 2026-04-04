"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface GraphNode {
  id: string;
  type: 'atom' | 'entity';
  label: string;
  atomType: string;
  confidence: number;
  size: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

const TYPE_COLORS: Record<string, string> = {
  fact: '#3b82f6',
  decision: '#a855f7',
  preference: '#22c55e',
  solution: '#eab308',
  relationship: '#ec4899',
  process: '#f97316',
  context: '#06b6d4',
  entity: '#6b7280',
};

export default function GraphPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    fetch("/api/knowledge/graph")
      .then((r) => r.json())
      .then((data) => {
        // Initialize positions randomly
        const initialized = (data.nodes || []).map((n: GraphNode) => ({
          ...n,
          x: Math.random() * 800 + 100,
          y: Math.random() * 500 + 50,
          vx: 0,
          vy: 0,
        }));
        setNodes(initialized);
        setEdges(data.edges || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Simple force-directed layout
  useEffect(() => {
    if (nodes.length === 0) return;

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const simulate = () => {
      const updated = [...nodes];

      // Repulsion between all nodes
      for (let i = 0; i < updated.length; i++) {
        for (let j = i + 1; j < updated.length; j++) {
          const dx = updated[j].x! - updated[i].x!;
          const dy = updated[j].y! - updated[i].y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 500 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          updated[i].vx! -= fx;
          updated[i].vy! -= fy;
          updated[j].vx! += fx;
          updated[j].vy! += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const s = updated.find((n) => n.id === edge.source);
        const t = updated.find((n) => n.id === edge.target);
        if (!s || !t) continue;
        const dx = t.x! - s.x!;
        const dy = t.y! - s.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 120) * 0.01;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        s.vx! += fx;
        s.vy! += fy;
        t.vx! -= fx;
        t.vy! -= fy;
      }

      // Center gravity
      for (const n of updated) {
        n.vx! += (500 - n.x!) * 0.001;
        n.vy! += (300 - n.y!) * 0.001;
        n.vx! *= 0.9; // Damping
        n.vy! *= 0.9;
        n.x! += n.vx!;
        n.y! += n.vy!;
        // Bounds
        n.x = Math.max(20, Math.min(980, n.x!));
        n.y = Math.max(20, Math.min(580, n.y!));
      }

      setNodes(updated);
    };

    let frame = 0;
    const tick = () => {
      if (frame < 200) {
        simulate();
        frame++;
        animRef.current = requestAnimationFrame(tick);
      }
    };
    animRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animRef.current);
  }, [nodes.length, edges.length]); // Only restart on data change

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 1000 * dpr;
    canvas.height = 600 * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, 1000, 600);

    // Draw edges
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (const edge of edges) {
      const s = nodes.find((n) => n.id === edge.source);
      const t = nodes.find((n) => n.id === edge.target);
      if (!s || !t) continue;
      ctx.beginPath();
      ctx.moveTo(s.x!, s.y!);
      ctx.lineTo(t.x!, t.y!);
      ctx.stroke();
    }

    // Draw nodes
    for (const node of nodes) {
      const color = TYPE_COLORS[node.atomType] || '#888';
      const radius = node.type === 'entity' ? node.size / 3 : node.size / 4;

      ctx.beginPath();
      ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2);
      ctx.fillStyle = color + '40';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = node === hoveredNode ? 2 : 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = node.type === 'entity' ? 'bold 9px sans-serif' : '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        node.label.substring(0, 25) + (node.label.length > 25 ? '...' : ''),
        node.x!,
        node.y! + radius + 12
      );
    }
  }, [nodes, edges, hoveredNode]);

  // Mouse hover
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hovered = nodes.find((n) => {
      const dx = n.x! - x;
      const dy = n.y! - y;
      return Math.sqrt(dx * dx + dy * dy) < n.size / 3 + 5;
    });
    setHoveredNode(hovered || null);
  };

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Knowledge Graph</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visual map of your organizational knowledge
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/chat")}>
            Back to Chat
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-sm text-muted-foreground">Loading graph...</div>
        ) : nodes.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-3xl mb-3">{"\u{1F578}"}</div>
            <p className="text-sm text-muted-foreground">
              No knowledge to visualize yet. Start chatting to build your knowledge graph.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-border flex-wrap">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-muted-foreground capitalize">{type}</span>
                </div>
              ))}
              <span className="text-[10px] text-muted-foreground ml-auto">
                {nodes.length} nodes, {edges.length} connections
              </span>
            </div>

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={1000}
              height={600}
              className="w-full h-[600px] cursor-crosshair"
              onMouseMove={handleMouseMove}
            />

            {/* Hover tooltip */}
            {hoveredNode && (
              <div className="px-4 py-2 border-t border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[hoveredNode.atomType] || '#888' }}
                  />
                  <span className="text-xs font-medium capitalize">{hoveredNode.atomType}</span>
                  {hoveredNode.type === 'atom' && (
                    <span className="text-[10px] text-muted-foreground">
                      {(hoveredNode.confidence * 100).toFixed(0)}% confidence
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{hoveredNode.label}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
