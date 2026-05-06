'use client';
import type { Dispatch, SetStateAction } from 'react';

const KINDS: Array<{ id: string; label: string }> = [
  { id: 'topic',       label: 'Topics' },
  { id: 'atom',        label: 'Atoms' },
  { id: 'source',      label: 'Sources' },
  { id: 'entity',      label: 'Entities' },
  { id: 'contributor', label: 'Contributors' },
];

interface Props {
  value: Set<string>;
  setValue: Dispatch<SetStateAction<Set<string>>>;
}

export function Filters({ value, setValue }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      {KINDS.map((k) => {
        const on = value.has(k.id);
        return (
          <button
            key={k.id}
            onClick={() =>
              setValue((s) => {
                const next = new Set(s);
                if (next.has(k.id)) next.delete(k.id); else next.add(k.id);
                return next;
              })
            }
            className={
              on
                ? 'text-xs px-3 py-1 rounded-full bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900'
                : 'text-xs px-3 py-1 rounded-full bg-stone-200/70 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
            }
          >
            {k.label}
          </button>
        );
      })}
    </div>
  );
}
