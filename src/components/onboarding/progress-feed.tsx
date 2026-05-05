'use client';
import { useEffect, useState } from 'react';

interface Job {
  id: string;
  kind: string;
  filename: string | null;
  status: string;
  chunkCount: number | null;
  errorMessage: string | null;
  meta: Record<string, unknown> | null;
  updatedAt: string;
}

export function ProgressFeed() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [chunks, setChunks] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const r = await fetch('/api/onboarding/status');
      if (!r.ok) return;
      const j = await r.json();
      if (!alive) return;
      setJobs(j.jobs ?? []);
      setChunks(j.totalChunks ?? 0);
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div>
      <p className="text-sm mb-2 text-stone-700 dark:text-stone-300">
        <span className="font-mono">{chunks}</span> chunks indexed across all sources
      </p>
      {jobs.length === 0 ? (
        <p className="text-xs text-stone-500">No activity yet.</p>
      ) : (
        <ul className="space-y-1 text-xs font-mono">
          {jobs.map((j) => {
            const label = j.filename ?? (j.meta && typeof j.meta.url === 'string' ? j.meta.url : j.kind);
            return (
              <li key={j.id} className="flex justify-between gap-2">
                <span className="truncate">
                  <span className="text-stone-500">{j.kind}</span> {label} — <span className={j.status === 'complete' ? 'text-emerald-600' : j.status === 'failed' ? 'text-orange-600' : 'text-stone-500'}>{j.status}</span>
                  {j.errorMessage ? <span className="text-orange-600"> · {j.errorMessage}</span> : null}
                </span>
                <span className="text-stone-500 shrink-0">{j.chunkCount ?? 0} chunks</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
