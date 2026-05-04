"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Scope = 'personal' | 'team' | 'organization';

interface AdminAtom {
  id: string;
  type: string;
  scope: Scope;
  scope_id: string;
  content: string;
  confidence: number;
  status: string;
  topics: string[];
  source_user_id: string | null;
  source_user_name: string | null;
  scope_label: string | null;
  created_at: string;
  affirmed_count: number;
}

interface ConflictRow {
  id: string;
  status: string;
  created_at: string;
  atom_a_id: string;
  atom_a_content: string;
  atom_a_scope: Scope;
  atom_a_confidence: number;
  atom_b_id: string;
  atom_b_content: string;
  atom_b_scope: Scope;
  atom_b_confidence: number;
}

interface TeamOption {
  id: string;
  name: string;
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

const SCOPE_LABEL: Record<Scope, string> = {
  personal: "Personal",
  team: "Team",
  organization: "Org",
};

export default function AdminKnowledgePage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'atoms' | 'conflicts'>('atoms');
  const [atoms, setAtoms] = useState<AdminAtom[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [scopeFilter, setScopeFilter] = useState<Scope | 'all'>('all');
  const [loading, setLoading] = useState(false);

  // Gate access by role
  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const role = d?.user?.role;
        setAllowed(role === 'admin' || role === 'owner');
      })
      .catch(() => setAllowed(false));
  }, []);

  const refreshAtoms = useCallback(async () => {
    setLoading(true);
    const qs = scopeFilter === 'all' ? '' : `?scope=${scopeFilter}`;
    try {
      const res = await fetch(`/api/admin/knowledge/atoms${qs}`);
      if (res.ok) {
        const data = await res.json();
        setAtoms(data.atoms || []);
      }
    } finally {
      setLoading(false);
    }
  }, [scopeFilter]);

  const refreshConflicts = useCallback(async () => {
    const res = await fetch("/api/admin/knowledge/conflicts");
    if (res.ok) {
      const data = await res.json();
      setConflicts(data.conflicts || []);
    }
  }, []);

  useEffect(() => {
    if (allowed) {
      fetch("/api/teams")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setTeams((d?.teams || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))))
        .catch(() => {});
    }
  }, [allowed]);

  useEffect(() => {
    if (allowed && tab === 'atoms') refreshAtoms();
    if (allowed && tab === 'conflicts') refreshConflicts();
  }, [allowed, tab, refreshAtoms, refreshConflicts]);

  const setScope = async (atomId: string, scope: Scope, scopeId?: string) => {
    const res = await fetch(`/api/admin/knowledge/atoms/${atomId}/scope`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, scopeId }),
    });
    if (res.ok) refreshAtoms();
  };

  const resolveConflict = async (conflictId: string) => {
    const res = await fetch(`/api/admin/knowledge/conflicts?id=${conflictId}`, { method: "PATCH" });
    if (res.ok) refreshConflicts();
  };

  const [reconciling, setReconciling] = useState(false);
  const runReconcile = async () => {
    setReconciling(true);
    try {
      const res = await fetch("/api/knowledge/reconcile", { method: "POST" });
      if (res.ok) {
        const { report } = await res.json();
        alert(
          `Reconciliation complete:\n` +
          `- ${report.decayedCount} atoms decayed\n` +
          `- ${report.staleCount} marked stale\n` +
          `- ${report.conflictsFound} new conflicts\n` +
          `- ${report.promotedToTeam || 0} promoted personal→team\n` +
          `- ${report.promotedToOrg || 0} promoted team→org`
        );
        refreshAtoms();
        refreshConflicts();
      }
    } finally {
      setReconciling(false);
    }
  };

  if (allowed === null) {
    return <PageShell><p className="text-xs text-muted-foreground">Checking access…</p></PageShell>;
  }

  if (!allowed) {
    return (
      <PageShell>
        <div className="border border-border/40 rounded-lg px-6 py-10 text-center">
          <LockIcon className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium mb-1">Admins only</p>
          <p className="text-xs text-muted-foreground mb-4">
            This page manages organizational knowledge. Ask an owner to grant you the admin role.
          </p>
          <Button size="sm" variant="outline" onClick={() => router.push("/chat")}>Back to chat</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/chat")} className="-ml-2">
            <ArrowLeftIcon className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-sm font-semibold">Knowledge admin</h1>
            <p className="text-[11px] text-muted-foreground">
              Inspect provenance, change scope, resolve conflicts.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={runReconcile} disabled={reconciling}>
            {reconciling ? "Reconciling…" : "Run reconciliation"}
          </Button>
          <div className="flex items-center gap-1 bg-muted/30 rounded-md p-0.5">
            <button
              onClick={() => setTab('atoms')}
              className={cn(
                "text-xs px-3 py-1 rounded transition-colors",
                tab === 'atoms' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Atoms
            </button>
            <button
              onClick={() => setTab('conflicts')}
              className={cn(
                "text-xs px-3 py-1 rounded transition-colors flex items-center gap-1.5",
                tab === 'conflicts' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Conflicts
              {conflicts.length > 0 && (
                <span className="text-[9px] bg-yellow-500/20 text-yellow-400 rounded px-1.5">{conflicts.length}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {tab === 'atoms' && (
            <>
              <div className="flex items-center gap-1 mb-4">
                {(['all', 'personal', 'team', 'organization'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScopeFilter(s)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                      scopeFilter === s
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "text-muted-foreground border-transparent hover:border-border"
                    )}
                  >
                    {s === 'all' ? 'All' : SCOPE_LABEL[s]}
                  </button>
                ))}
              </div>

              {loading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : atoms.length === 0 ? (
                <p className="text-xs text-muted-foreground">No atoms in this scope.</p>
              ) : (
                <div className="space-y-2">
                  {atoms.map((a) => (
                    <AdminAtomRow
                      key={a.id}
                      atom={a}
                      teams={teams}
                      onScopeChange={setScope}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'conflicts' && (
            <>
              {conflicts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No open conflicts.</p>
              ) : (
                <div className="space-y-3">
                  {conflicts.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-yellow-400">Conflict</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <ConflictAtomCard
                          content={c.atom_a_content}
                          scope={c.atom_a_scope}
                          confidence={c.atom_a_confidence}
                        />
                        <ConflictAtomCard
                          content={c.atom_b_content}
                          scope={c.atom_b_scope}
                          confidence={c.atom_b_confidence}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => resolveConflict(c.id)}>
                          Mark resolved
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminAtomRow({
  atom,
  teams,
  onScopeChange,
}: {
  atom: AdminAtom;
  teams: TeamOption[];
  onScopeChange: (atomId: string, scope: Scope, scopeId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-normal", TYPE_COLORS[atom.type])}>
              {atom.type}
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal">
              {SCOPE_LABEL[atom.scope]}
              {atom.scope_label && ` · ${atom.scope_label}`}
            </Badge>
            <span className="text-[9px] text-muted-foreground">{(atom.confidence * 100).toFixed(0)}% conf</span>
            <span className="text-[9px] text-muted-foreground/70">
              · ×{atom.affirmed_count} affirmations
            </span>
            {atom.source_user_name && (
              <span className="text-[9px] text-muted-foreground/70">· from {atom.source_user_name}</span>
            )}
          </div>
          <p className="text-xs leading-relaxed">{atom.content}</p>
        </div>
        <Button size="sm" variant="ghost" className="text-[10px] shrink-0" onClick={() => setOpen(!open)}>
          {open ? "Cancel" : "Change scope"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-border/30 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={atom.scope === 'personal' ? 'secondary' : 'outline'}
            className="text-[10px] h-6"
            onClick={() => atom.source_user_id && onScopeChange(atom.id, 'personal', atom.source_user_id)}
            disabled={!atom.source_user_id}
            title={!atom.source_user_id ? "No source user — cannot demote" : ""}
          >
            Personal
          </Button>
          {teams.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={atom.scope === 'team' && atom.scope_id === t.id ? 'secondary' : 'outline'}
              className="text-[10px] h-6"
              onClick={() => onScopeChange(atom.id, 'team', t.id)}
            >
              Team · {t.name}
            </Button>
          ))}
          <Button
            size="sm"
            variant={atom.scope === 'organization' ? 'secondary' : 'outline'}
            className="text-[10px] h-6"
            onClick={() => onScopeChange(atom.id, 'organization')}
          >
            Company-wide
          </Button>
        </div>
      )}
    </div>
  );
}

function ConflictAtomCard({ content, scope, confidence }: { content: string; scope: Scope; confidence: number }) {
  return (
    <div className="rounded-md border border-border/40 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal">{SCOPE_LABEL[scope]}</Badge>
        <span className="text-[9px] text-muted-foreground">{(confidence * 100).toFixed(0)}% conf</span>
      </div>
      <p className="text-xs leading-relaxed">{content}</p>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-sm font-semibold">Knowledge admin</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-12">{children}</div>
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

function LockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
