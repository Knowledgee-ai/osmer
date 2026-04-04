"use client";

import { useState, useEffect, useCallback } from "react";
import { getKnowledgeAtoms, removeKnowledgeAtom, type LocalKnowledgeAtom } from "@/lib/knowledge/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface KnowledgePanelProps {
  open: boolean;
  onClose: () => void;
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

interface KnowledgeStats {
  total: number;
  healthScore: number;
  confidence: { avg: number; min: number; max: number };
  topTopics: Array<{ topic: string; count: number }>;
  openConflicts: number;
  recentCount: number;
  byType: Array<{ type: string; count: number }>;
}

interface TeamInfo {
  id: string;
  name: string;
}

export function KnowledgePanel({ open, onClose }: KnowledgePanelProps) {
  const [atoms, setAtoms] = useState<LocalKnowledgeAtom[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [teams, setTeams] = useState<TeamInfo[]>([]);

  const refreshAtoms = useCallback(async () => {
    // Try DB first, fall back to localStorage
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge/atoms");
      if (res.ok) {
        const data = await res.json();
        if (data.atoms?.length > 0) {
          setAtoms(data.atoms.map((a: Record<string, unknown>) => ({
            id: a.id as string,
            type: a.type as string,
            content: a.content as string,
            confidence: a.confidence as number,
            topics: (a.topics as string[]) || [],
            entities: (a.entities as string[]) || [],
            extractedBy: (a.extractedBy as string) || "",
            createdAt: a.createdAt as string,
            scope: "personal",
            sourceConversationId: null,
            lastAffirmed: a.createdAt as string,
            affirmedCount: 1,
          })));
          setLoading(false);
          return;
        }
      }
    } catch {}

    // Fall back to localStorage
    setAtoms(getKnowledgeAtoms());
    setLoading(false);
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch {}
  }, []);

  const refreshTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams((data.teams || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (open) {
      refreshAtoms();
      refreshStats();
      refreshTeams();
    }
  }, [open, refreshAtoms, refreshStats, refreshTeams]);

  const filtered = atoms.filter((atom) => {
    if (filterType && atom.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        atom.content.toLowerCase().includes(q) ||
        atom.topics.some((t) => t.toLowerCase().includes(q)) ||
        atom.entities.some((e) => e.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    // Remove locally
    removeKnowledgeAtom(id);
    setAtoms((prev) => prev.filter((a) => a.id !== id));
    // Remove from DB
    fetch(`/api/knowledge/atoms/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const handleReconcile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge/reconcile", { method: "POST" });
      if (res.ok) {
        const { report } = await res.json();
        alert(
          `Reconciliation complete:\n` +
          `- ${report.decayedCount} atoms decayed\n` +
          `- ${report.staleCount} marked stale\n` +
          `- ${report.conflictsFound} conflicts found\n` +
          `- ${report.totalAtoms} total atoms`
        );
        refreshAtoms();
      }
    } catch {
      alert("Reconciliation failed");
    }
    setLoading(false);
  };

  const typeCounts = atoms.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!open) return null;

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <BrainIcon className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Knowledge Base</span>
          <Badge variant="secondary" className="text-[10px] font-normal">
            {atoms.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {stats && (
            <button
              onClick={() => setShowStats(!showStats)}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors"
            >
              Health: {stats.healthScore}%
            </button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Health Dashboard */}
      {showStats && stats && (
        <div className="px-3 py-2.5 border-b border-border bg-muted/10 space-y-2">
          {/* Health Score Bar */}
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Knowledge Health</span>
              <span className={cn(
                "font-medium",
                stats.healthScore >= 70 ? "text-green-400" :
                stats.healthScore >= 40 ? "text-yellow-400" :
                "text-red-400"
              )}>
                {stats.healthScore}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  stats.healthScore >= 70 ? "bg-green-500" :
                  stats.healthScore >= 40 ? "bg-yellow-500" :
                  "bg-red-500"
                )}
                style={{ width: `${stats.healthScore}%` }}
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-sm font-semibold">{stats.total}</div>
              <div className="text-[9px] text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold">{stats.recentCount}</div>
              <div className="text-[9px] text-muted-foreground">This week</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-primary">{(stats.confidence.avg * 100).toFixed(0)}%</div>
              <div className="text-[9px] text-muted-foreground">Avg conf.</div>
            </div>
          </div>

          {/* Top Topics */}
          {stats.topTopics.length > 0 && (
            <div>
              <div className="text-[9px] text-muted-foreground mb-1">Top Topics</div>
              <div className="flex flex-wrap gap-1">
                {stats.topTopics.slice(0, 6).map((t) => (
                  <span key={t.topic} className="text-[9px] bg-muted/50 rounded px-1.5 py-0.5 text-muted-foreground">
                    {t.topic} ({t.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {stats.openConflicts > 0 && (
            <div className="text-[10px] text-yellow-400 bg-yellow-500/10 rounded px-2 py-1">
              {stats.openConflicts} unresolved conflict{stats.openConflicts > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <Input
          placeholder="Search knowledge..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
      </div>

      {/* Type filters */}
      <div className="px-3 py-2 border-b border-border flex flex-wrap gap-1">
        <button
          onClick={() => setFilterType(null)}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
            !filterType
              ? "bg-primary/10 text-primary border-primary/20"
              : "text-muted-foreground border-transparent hover:border-border"
          )}
        >
          All ({atoms.length})
        </button>
        {Object.entries(typeCounts).map(([type, count]) => (
          <button
            key={type}
            onClick={() => setFilterType(filterType === type ? null : type)}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
              filterType === type
                ? TYPE_COLORS[type]
                : "text-muted-foreground border-transparent hover:border-border"
            )}
          >
            {type} ({count})
          </button>
        ))}
      </div>

      {/* Atoms list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {loading ? (
            <div className="text-center py-8">
              <div className="h-5 w-5 mx-auto animate-spin rounded-full border-2 border-muted border-t-primary mb-2" />
              <p className="text-xs text-muted-foreground">Loading knowledge...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <BrainIcon className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">
                {atoms.length === 0
                  ? "No knowledge extracted yet. Start chatting to build your knowledge base."
                  : "No matching knowledge found."}
              </p>
            </div>
          ) : (
            filtered.map((atom) => (
              <KnowledgeAtomCard
                key={atom.id}
                atom={atom}
                teams={teams}
                onDelete={() => handleDelete(atom.id)}
                onPromote={async (teamId) => {
                  await fetch(`/api/knowledge/atoms/${atom.id}/promote`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ teamId }),
                  });
                  refreshAtoms();
                }}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {atoms.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
            <span>
              Avg confidence: {(atoms.reduce((s, a) => s + a.confidence, 0) / atoms.length).toFixed(2)}
            </span>
            <span>
              {new Set(atoms.flatMap((a) => a.topics)).size} topics
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-[10px]"
            onClick={handleReconcile}
            disabled={loading}
          >
            {loading ? "Running..." : "Run Reconciliation"}
          </Button>
        </div>
      )}
    </div>
  );
}

function KnowledgeAtomCard({
  atom,
  teams,
  onDelete,
  onPromote,
}: {
  atom: LocalKnowledgeAtom;
  teams: TeamInfo[];
  onDelete: () => void;
  onPromote: (teamId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isTeamScoped = atom.scope === "team";

  return (
    <div
      className={cn(
        "group rounded-lg border p-2.5 hover:border-border transition-colors cursor-pointer",
        isTeamScoped ? "border-primary/20 bg-primary/5" : "border-border/50"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Badge
              variant="outline"
              className={cn("text-[9px] px-1.5 py-0 font-normal", TYPE_COLORS[atom.type])}
            >
              {atom.type}
            </Badge>
            {isTeamScoped && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal bg-primary/10 text-primary border-primary/20">
                team
              </Badge>
            )}
            <span className="text-[9px] text-muted-foreground">
              {(atom.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <p className={cn("text-xs leading-relaxed", !expanded && "line-clamp-2")}>
            {atom.content}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <XIcon className="h-3 w-3" />
        </Button>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/30 space-y-1.5">
          {atom.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {atom.topics.map((topic) => (
                <span
                  key={topic}
                  className="text-[9px] bg-muted/50 rounded px-1.5 py-0.5 text-muted-foreground"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
          {atom.entities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {atom.entities.map((entity) => (
                <span
                  key={entity}
                  className="text-[9px] bg-primary/5 rounded px-1.5 py-0.5 text-primary/70"
                >
                  {entity}
                </span>
              ))}
            </div>
          )}
          <div className="text-[9px] text-muted-foreground/50">
            Extracted {new Date(atom.createdAt).toLocaleDateString()} via {atom.extractedBy?.split('/').pop() || 'unknown'}
          </div>
          {/* Share to team */}
          {!isTeamScoped && teams.length > 0 && (
            <div className="pt-1">
              <div className="flex flex-wrap gap-1">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPromote(team.id);
                    }}
                    className="text-[9px] text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 rounded px-2 py-0.5 transition-colors"
                  >
                    Share to {team.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}
