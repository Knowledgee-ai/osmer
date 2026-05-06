'use client';
import { useState } from 'react';
import { Graph2D } from '@/components/memory-map/graph-2d';
import { Filters } from '@/components/memory-map/filters';
import { ContributorPanel } from '@/components/memory-map/contributor-panel';

export default function MapPage() {
  const [filterKinds, setFilterKinds] = useState<Set<string>>(
    new Set(['topic', 'atom', 'entity', 'contributor']),
  );
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="h-[calc(100vh-4rem)] grid grid-cols-[1fr_280px] gap-0">
      <div className="relative bg-[var(--paper,_theme(colors.stone.50))] dark:bg-stone-950">
        <div className="absolute top-4 left-4 z-10">
          <Filters value={filterKinds} setValue={setFilterKinds} />
        </div>
        <div className="absolute inset-0">
          <Graph2D filterKinds={filterKinds} selectedContributor={selected} />
        </div>
      </div>

      <aside className="border-l border-stone-200 dark:border-stone-800 px-4 py-6 overflow-y-auto">
        <h2 className="text-xs uppercase tracking-wide text-stone-500 mb-3">Top contributors</h2>
        <ContributorPanel selected={selected} onSelect={setSelected} />
        <div className="mt-6 text-xs text-stone-500 leading-relaxed">
          Click a contributor to see their footprint. Click a source node to open it.
        </div>
      </aside>
    </div>
  );
}
