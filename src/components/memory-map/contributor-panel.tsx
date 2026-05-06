'use client';
import { useEffect, useState } from 'react';

interface Contributor {
  userId: string;
  name: string;
  score: number;
  weekDelta: number;
}

interface Props {
  selected: string | null;
  onSelect?: (id: string | null) => void;
}

export function ContributorPanel({ selected, onSelect }: Props) {
  const [list, setList] = useState<Contributor[]>([]);
  const [anonymous, setAnonymous] = useState(false);

  useEffect(() => {
    fetch('/api/memory/contributors')
      .then((r) => r.json())
      .then((j) => {
        setList(j.contributors ?? []);
        setAnonymous(!!j.anonymous);
      })
      .catch(() => { /* leave empty */ });
  }, []);

  if (anonymous) {
    return (
      <p className="text-xs text-stone-500">
        Contributor attribution is hidden by your organization&rsquo;s admin.
      </p>
    );
  }
  if (list.length === 0) {
    return <p className="text-xs text-stone-500">No contributor data yet.</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {list.slice(0, 12).map((c) => {
        const id = `user:${c.userId}`;
        const active = selected === id;
        return (
          <li key={c.userId}>
            <button
              onClick={() => onSelect?.(active ? null : id)}
              className={
                'w-full flex items-center justify-between rounded px-2 py-1 text-left transition-colors ' +
                (active
                  ? 'bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900'
                  : 'hover:bg-stone-100 dark:hover:bg-stone-800/60')
              }
            >
              <span className="truncate">{c.name}</span>
              <span className="text-xs tabular-nums opacity-70 ml-2">{c.score}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
