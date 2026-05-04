"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useChatStore } from "@/stores/chat-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { OsmerMark } from "@/components/brand/osmer-mark";

interface AppSidebarProps {
  onOpenSettings?: () => void;
}

export function AppSidebar({ onOpenSettings }: AppSidebarProps) {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    setConversations,
    removeConversation,
    sidebarOpen,
    setSidebarOpen,
  } = useChatStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Load conversations from DB on mount
  useEffect(() => {
    fetch("/api/conversations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.conversations?.length > 0) {
          setConversations(
            data.conversations.map((c: { id: string; title: string; modelDefault: string; updatedAt: string; visibility?: 'private' | 'team' | 'organization'; teamId?: string | null }) => ({
              id: c.id,
              title: c.title,
              modelDefault: c.modelDefault,
              updatedAt: c.updatedAt,
              visibility: c.visibility ?? 'private',
              teamId: c.teamId ?? null,
            }))
          );
        }
      })
      .catch(() => {});
  }, [setConversations]);

  const [searchResults, setSearchResults] = useState<Array<{ conversationId: string; title: string; matchPreview: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (search.length < 3) {
      setSearchResults([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch("/api/conversations/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: search }),
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch {}
      setIsSearching(false);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const filteredConversations = search
    ? conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const serverOnlyResults = searchResults.filter(
    (sr) => !filteredConversations.some((c) => c.id === sr.conversationId)
  );

  const handleNewChat = () => {
    setActiveConversation(null);
    setSearch("");
  };

  if (!sidebarOpen) {
    return (
      <div className="flex flex-col items-center py-5 px-2 border-r border-border/60 bg-sidebar gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <PanelLeftIcon className="h-4 w-4" />
        </button>
        <button
          onClick={handleNewChat}
          aria-label="New chat"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[260px] border-r border-border/60 bg-sidebar h-full">
      {/* Editorial header — wordmark + collapse toggle, hairline below */}
      <div className="px-5 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <OsmerMark size={26} quiet />
            <span
              className="text-[1.05rem] tracking-[-0.022em] text-foreground"
              style={{ fontWeight: 600, fontFamily: "var(--font-body), system-ui, sans-serif" }}
            >
              Osmer
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Collapse sidebar"
            className="text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <PanelLeftIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={handleNewChat}
          className="mono mt-5 flex w-full items-center justify-between rounded-[2px] border border-foreground/80 bg-foreground px-3 py-2 text-[0.68rem] tracking-[0.14em] text-background transition-colors hover:bg-[var(--clay-deep)] hover:border-[var(--clay-deep)]"
        >
          <span>Begin a conversation</span>
          <ArrowEastIcon className="h-3 w-3" />
        </button>
      </div>

      {/* Search */}
      {conversations.length > 0 && (
        <div className="px-5 py-3 border-b border-border/60">
          <div className="relative">
            <SearchIcon className="absolute left-0 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the archive…"
              className="w-full pl-5 pr-2 py-1.5 text-[0.78rem] bg-transparent border-0 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0"
              style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}
            />
          </div>
        </div>
      )}

      {/* Conversations */}
      <ScrollArea className="flex-1">
        <div className="px-5 pt-5 pb-3">
          <div className="mono mb-3 text-muted-foreground/80">
            {search ? "Matches" : "Recent"}
          </div>

          {filteredConversations.length === 0 ? (
            <div className="py-6 text-[0.78rem] text-muted-foreground/70 leading-relaxed">
              {search ? (
                <>No matching conversations.</>
              ) : (
                <>
                  Nothing yet. The archive fills in as you talk to the
                  models — every thread becomes part of your team&rsquo;s
                  memory.
                </>
              )}
            </div>
          ) : (
            <ul className="space-y-px">
              {filteredConversations.map((conv) => {
                const isActive = activeConversationId === conv.id;
                return (
                  <li
                    key={conv.id}
                    onClick={() => setActiveConversation(conv.id)}
                    onMouseEnter={() => setHoveredId(conv.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={cn(
                      "group relative flex cursor-pointer items-center gap-2 px-2 py-2 -mx-2 text-[0.82rem] leading-[1.35] transition-colors",
                      isActive
                        ? "text-foreground"
                        : "text-foreground/70 hover:text-foreground"
                    )}
                  >
                    {/* Active marker (clay rule on the left) */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-0 top-1/2 h-[1.25em] w-[2px] -translate-y-1/2 rounded-full transition-colors",
                        isActive ? "bg-[var(--clay)]" : "bg-transparent"
                      )}
                    />
                    <span className="flex-1 truncate pl-2">{conv.title}</span>
                    {hoveredId === conv.id && (
                      <button
                        className="text-muted-foreground/60 hover:text-foreground transition-colors"
                        aria-label="Delete conversation"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeConversation(conv.id);
                          fetch(`/api/conversations/${conv.id}`, { method: "DELETE" }).catch(() => {});
                        }}
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {serverOnlyResults.length > 0 && (
            <>
              <div className="mono mt-6 mb-3 text-muted-foreground/80">
                In messages
              </div>
              <ul className="space-y-px">
                {serverOnlyResults.map((sr) => (
                  <li
                    key={sr.conversationId}
                    onClick={() => {
                      setActiveConversation(sr.conversationId);
                      setSearch("");
                    }}
                    className="cursor-pointer px-2 py-2 -mx-2 text-foreground/70 transition-colors hover:text-foreground"
                  >
                    <div className="text-[0.82rem] truncate">{sr.title}</div>
                    <div className="text-[0.7rem] text-muted-foreground/70 line-clamp-1 mt-0.5">
                      {sr.matchPreview}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {isSearching && (
            <div className="mono mt-3 text-muted-foreground/60 animate-pulse">
              Searching…
            </div>
          )}
        </div>
      </ScrollArea>

      <SidebarFooter onOpenSettings={onOpenSettings} />
    </div>
  );
}

function SidebarFooter({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { data: session } = useSession();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRole(d?.user?.role ?? null))
      .catch(() => {});
  }, [session?.user?.id]);

  const isAdmin = role === 'admin' || role === 'owner';

  return (
    <div className="border-t border-border/60 px-5 py-4">
      <div className="mono mb-3 text-muted-foreground/80">Memory</div>
      <nav className="space-y-1">
        <FooterLink href="/chat/teams" label="Teams" />
        <FooterLink href="/chat/analytics" label="Analytics" />
        <FooterLink href="/chat/ask" label="Ask the company" />
        <FooterLink href="/chat/graph" label="Knowledge graph" />
        {isAdmin && <FooterLink href="/chat/admin/knowledge" label="Knowledge admin" />}
        <button
          onClick={onOpenSettings}
          className="block w-full text-left text-[0.82rem] text-foreground/70 transition-colors hover:text-foreground py-1"
        >
          Settings
        </button>
      </nav>

      {session?.user && (
        <div className="mt-5 flex items-center gap-2.5 border-t border-border/60 pt-4">
          <div className="h-7 w-7 rounded-full border border-border/80 flex items-center justify-center shrink-0 bg-background">
            <span className="text-[10px] font-semibold tracking-[0.05em] text-foreground">
              {session.user.name?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.78rem] truncate text-foreground leading-tight">
              {session.user.name}
            </div>
            <div className="mono text-muted-foreground/70 mt-0.5">
              <NotificationLabel />
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            aria-label="Sign out"
            className="text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <LogOutIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block text-[0.82rem] text-foreground/70 transition-colors hover:text-foreground py-1"
    >
      {label}
    </a>
  );
}

function NotificationLabel() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setCount(d.unreadCount || 0);
      })
      .catch(() => {});
  }, []);

  if (count === 0) return <span>Active session</span>;
  return <span>{count} new notification{count === 1 ? "" : "s"}</span>;
}

/* ---------- Inline icons ---------- */

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={className}>
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}
function PanelLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" className={className}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}
function ArrowEastIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 7h10" /><path d="m8 3 4 4-4 4" />
    </svg>
  );
}
