"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useChatStore } from "@/stores/chat-store";

interface Source {
  n: number;
  id: string;
  content: string;
  type: string;
  confidence: number;
  similarity: number;
}

interface AskResult {
  question: string;
  answer: string;
  sources: Source[];
  ts: string;
}

const TYPE_COLORS: Record<string, string> = {
  fact: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  decision: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  preference: "bg-green-500/10 text-green-400 border-green-500/20",
  solution: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  relationship: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  process: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  context: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

export default function AskPage() {
  const router = useRouter();
  const { selectedModel } = useChatStore();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AskResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, modelId: selectedModel }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const data = await res.json() as { answer: string; sources: Source[] };
      setResults((prev) => [
        { question: q, answer: data.answer, sources: data.sources, ts: new Date().toISOString() },
        ...prev,
      ]);
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/chat")} className="-ml-2">
            <ArrowLeftIcon className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-sm font-semibold">Search the knowledge base</h1>
            <p className="text-[11px] text-muted-foreground">
              Grounded answers with citations. No outside knowledge, no hallucination.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          <div className="space-y-2">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask anything that's been discussed before…"
              className="w-full min-h-[88px] resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/70">
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">⌘</kbd>{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">↵</kbd> to ask
              </span>
              <Button size="sm" onClick={submit} disabled={!question.trim() || loading}>
                {loading ? "Searching…" : "Ask"}
              </Button>
            </div>
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>

          {results.length === 0 && !loading && (
            <div className="rounded-lg border border-dashed border-border/60 px-6 py-10 text-center">
              <BrainIcon className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-xs text-muted-foreground">
                Answers come only from atoms extracted from past conversations. Nothing here yet?
                Have the conversation first — the knowledge base builds itself.
              </p>
            </div>
          )}

          {results.map((r) => (
            <article key={r.ts} className="space-y-3 border-t border-border/40 pt-6 first:border-t-0 first:pt-0">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                  Question
                </div>
                <p className="text-sm">{r.question}</p>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                  Answer
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.answer}</p>
              </div>
              {r.sources.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">
                    Sources ({r.sources.length})
                  </div>
                  <ol className="space-y-1.5">
                    {r.sources.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-md border border-border/40 px-3 py-2 text-xs flex items-start gap-2"
                      >
                        <span className="text-muted-foreground/70 font-mono shrink-0">[{s.n}]</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 font-normal ${TYPE_COLORS[s.type] || ""}`}
                            >
                              {s.type}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground">
                              {(s.confidence * 100).toFixed(0)}% confidence
                            </span>
                            <span className="text-[9px] text-muted-foreground/60">
                              · {(s.similarity * 100).toFixed(0)}% match
                            </span>
                          </div>
                          <p className="leading-relaxed text-foreground/90">{s.content}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
    </svg>
  );
}
