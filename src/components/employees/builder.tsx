'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ALL_TOOLS = [
  { id: 'memory.query',          label: 'Search company memory',           tier: 'baseline' },
  { id: 'memory.write',          label: 'Write back to memory (admin)',    tier: 'admin' },
  { id: 'web.search',            label: 'Web search',                       tier: 'baseline' },
  { id: 'web.fetch',             label: 'Fetch a URL',                       tier: 'paid' },
  { id: 'doc.markdown_to_pdf',   label: 'Generate document (PDF)',           tier: 'paid' },
  { id: 'doc.markdown_to_pptx',  label: 'Generate slide deck',               tier: 'paid' },
  { id: 'image.generate',        label: 'Generate image',                    tier: 'paid' },
  { id: 'email.draft',           label: 'Draft email (output only)',         tier: 'baseline' },
  { id: 'file.write',            label: 'Save file artifact',                tier: 'paid' },
] as const;

export function Builder() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tools, setTools] = useState<string[]>(['memory.query', 'web.search']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, description, toolbelt: tools, memoryScope: { kind: 'org' } }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.error ?? `Save failed: ${r.status}`);
        return;
      }
      const j = await r.json();
      router.push(`/chat/employees/${j.employee.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <header>
        <h1 className="font-serif text-3xl">New AI Employee</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
          Give it a name, describe the job, pick the tools it can use.
        </p>
      </header>

      <section>
        <label className="text-xs uppercase tracking-wide text-stone-500">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2 text-sm"
          placeholder="Account Brief Drafter"
        />
      </section>

      <section>
        <label className="text-xs uppercase tracking-wide text-stone-500">Job description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2 text-sm font-mono"
          placeholder="Given a customer name, produce a 1-2 page meeting prep brief…"
        />
      </section>

      <section>
        <label className="text-xs uppercase tracking-wide text-stone-500 mb-2 block">Toolbelt</label>
        <ul className="space-y-1">
          {ALL_TOOLS.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <input
                id={`tool-${t.id}`}
                type="checkbox"
                checked={tools.includes(t.id)}
                onChange={(e) => setTools(e.target.checked ? [...tools, t.id] : tools.filter((x) => x !== t.id))}
              />
              <label htmlFor={`tool-${t.id}`} className="flex-1">{t.label}</label>
              <span className="text-xs text-stone-500">{t.tier}</span>
            </li>
          ))}
        </ul>
      </section>

      {err ? <p className="text-xs text-orange-600">{err}</p> : null}

      <button
        disabled={!name || !description || busy}
        onClick={save}
        className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm disabled:opacity-40"
      >
        {busy ? 'Saving…' : 'Create employee'}
      </button>
    </div>
  );
}
