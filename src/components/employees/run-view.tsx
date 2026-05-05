'use client';
import { useState } from 'react';

interface RunResult {
  runId: string;
  status: 'complete' | 'awaiting_approval' | 'failed';
  output: string;
  approvalId?: string;
}

export function RunView({ employeeId }: { employeeId: string }) {
  const [inputs, setInputs] = useState('{\n  \n}');
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true); setError(null); setResult(null);
    try {
      const parsed = JSON.parse(inputs);
      const r = await fetch(`/api/employees/${employeeId}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (r.ok) {
        const j = await r.json() as RunResult;
        setResult(j);
      } else {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? `Run failed: ${r.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs uppercase tracking-wide text-stone-500">Inputs (JSON)</label>
        <textarea
          value={inputs}
          onChange={(e) => setInputs(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2 text-sm font-mono"
        />
      </div>
      <button
        onClick={run}
        disabled={busy}
        className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm disabled:opacity-40"
      >
        {busy ? 'Running…' : 'Run'}
      </button>
      {error ? <p className="text-xs text-orange-600">{error}</p> : null}
      {result ? (
        <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 p-4">
          <div className="text-xs text-stone-500 mb-2">
            run {result.runId.slice(0, 8)}… · status {result.status}
          </div>
          <pre className="text-sm whitespace-pre-wrap">{result.output}</pre>
          {result.status === 'awaiting_approval' && result.approvalId ? (
            <p className="text-xs text-amber-600 mt-3">
              This run is paused waiting for your approval (id {result.approvalId.slice(0, 8)}…).
              Approval UI is coming in M4.1; for now, decide via{' '}
              <code>POST /api/employees/{employeeId}/approvals/{result.approvalId}</code>.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
