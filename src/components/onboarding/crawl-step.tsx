'use client';
import { useState } from 'react';

export function CrawlStep() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const j = await r.json();
      if (r.ok) {
        setResult(`Crawled ${j.pagesCrawled} pages.`);
      } else {
        setResult(`Crawl failed: ${j.error ?? r.status}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2 items-center">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://yourcompany.com"
          className="flex-1 rounded-md border border-stone-300 dark:border-stone-700 px-3 py-2 text-sm bg-white dark:bg-stone-950"
        />
        <button
          onClick={go}
          disabled={!url.startsWith('http') || busy}
          className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm disabled:opacity-40"
        >
          {busy ? 'Crawling…' : 'Crawl'}
        </button>
      </div>
      {result ? <p className="text-xs text-stone-600 mt-2">{result}</p> : null}
    </div>
  );
}
