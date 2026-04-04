"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MODEL_MAP, PROVIDER_COLORS } from "@/lib/ai/models";

interface Analytics {
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  conversationCount: number;
  messageCount: number;
  spendByModel: Array<{ model: string; cost: number; requests: number; tokensIn: number; tokensOut: number }>;
  knowledgeGrowth: Array<{ day: string; count: number }>;
  recentActivity: Array<{ day: string; count: number }>;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then((d) => { setData(d.analytics); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Usage Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track your AI usage, costs, and knowledge growth
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/chat")}>
            Back to Chat
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Loading analytics...</div>
        ) : !data ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Failed to load analytics</div>
        ) : (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Cost" value={`$${data.totalCost.toFixed(4)}`} />
              <StatCard label="Conversations" value={String(data.conversationCount)} />
              <StatCard label="Messages" value={String(data.messageCount)} />
              <StatCard
                label="Total Tokens"
                value={formatNumber(data.totalTokensIn + data.totalTokensOut)}
              />
            </div>

            {/* Spend by Model */}
            {data.spendByModel.length > 0 && (
              <div className="rounded-xl border border-border p-4">
                <h2 className="text-sm font-medium mb-3">Cost by Model</h2>
                <div className="space-y-2">
                  {data.spendByModel.map((m) => {
                    const model = MODEL_MAP.get(m.model);
                    const maxCost = Math.max(...data.spendByModel.map((x) => x.cost));
                    const pct = maxCost > 0 ? (m.cost / maxCost) * 100 : 0;
                    return (
                      <div key={m.model} className="flex items-center gap-3">
                        <div className="w-32 flex items-center gap-1.5 shrink-0">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: PROVIDER_COLORS[model?.provider || ""] || "#888" }}
                          />
                          <span className="text-xs truncate">{model?.name || m.model}</span>
                        </div>
                        <div className="flex-1 h-4 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/40 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="w-20 text-right text-xs text-muted-foreground">
                          ${m.cost.toFixed(4)}
                        </div>
                        <div className="w-16 text-right text-xs text-muted-foreground">
                          {m.requests} req
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Activity Chart (simple bar) */}
            {data.recentActivity.length > 0 && (
              <div className="rounded-xl border border-border p-4">
                <h2 className="text-sm font-medium mb-3">Messages (Last 7 Days)</h2>
                <div className="flex items-end gap-1 h-24">
                  {data.recentActivity.map((d) => {
                    const max = Math.max(...data.recentActivity.map((x) => x.count));
                    const pct = max > 0 ? (d.count / max) * 100 : 0;
                    return (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className="w-full bg-primary/30 rounded-t transition-all"
                            style={{ height: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                        <span className="text-[8px] text-muted-foreground">
                          {new Date(d.day).toLocaleDateString(undefined, { weekday: "short" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Knowledge Growth */}
            {data.knowledgeGrowth.length > 0 && (
              <div className="rounded-xl border border-border p-4">
                <h2 className="text-sm font-medium mb-3">Knowledge Growth (Last 7 Days)</h2>
                <div className="flex items-end gap-1 h-24">
                  {data.knowledgeGrowth.map((d) => {
                    const max = Math.max(...data.knowledgeGrowth.map((x) => x.count));
                    const pct = max > 0 ? (d.count / max) * 100 : 0;
                    return (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className="w-full bg-green-500/30 rounded-t transition-all"
                            style={{ height: `${Math.max(pct, 5)}%` }}
                          />
                        </div>
                        <span className="text-[8px] text-muted-foreground">
                          {new Date(d.day).toLocaleDateString(undefined, { weekday: "short" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {data.messageCount === 0 && (
              <div className="text-center py-12">
                <div className="text-3xl mb-3">{"\u{1F4CA}"}</div>
                <p className="text-sm text-muted-foreground">
                  No usage data yet. Start chatting to see analytics here.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
