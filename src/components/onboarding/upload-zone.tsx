'use client';
import { useState, useRef } from 'react';

interface UploadZoneProps {
  onUploaded?: (jobId: string) => void;
}

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send(files: FileList) {
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', f);
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        if (r.ok) {
          const j = await r.json();
          onUploaded?.(j.jobId);
        } else {
          const j = await r.json().catch(() => ({}));
          setError(j.error ?? `Upload failed: ${r.status}`);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        className="rounded-md border border-dashed border-stone-300 dark:border-stone-700 p-10 text-center cursor-pointer hover:bg-stone-50/40 dark:hover:bg-stone-900/40 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) send(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && send(e.target.files)}
        />
        <p className="text-sm">{busy ? 'Uploading…' : 'Drop documents here or click to choose'}</p>
        <p className="text-xs text-stone-500 mt-2">
          PDF, DOCX, PPTX, XLSX, MD, TXT, ChatGPT/Claude exports — up to 50 MB
        </p>
      </div>
      {error ? <p className="text-xs text-orange-600 mt-2">{error}</p> : null}
    </div>
  );
}
