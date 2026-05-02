"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useChatStore } from "@/stores/chat-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
            data.conversations.map((c: { id: string; title: string; modelDefault: string; updatedAt: string }) => ({
              id: c.id,
              title: c.title,
              modelDefault: c.modelDefault,
              updatedAt: c.updatedAt,
            }))
          );
        }
      })
      .catch(() => {}); // Fall back to persisted Zustand state
  }, [setConversations]);

  const [searchResults, setSearchResults] = useState<Array<{ conversationId: string; title: string; matchPreview: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced server-side search
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

  // Local title filter for quick results, augmented by server search
  const filteredConversations = search
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  // Merge server search results that aren't already in filtered list
  const serverOnlyResults = searchResults.filter(
    (sr) => !filteredConversations.some((c) => c.id === sr.conversationId)
  );

  const handleNewChat = () => {
    setActiveConversation(null);
    setSearch("");
  };

  if (!sidebarOpen) {
    return (
      <div className="flex flex-col items-center py-3 px-2 border-r border-border bg-sidebar">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="mb-2"
        >
          <PanelLeftIcon className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleNewChat}>
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-64 border-r border-border bg-sidebar h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">K</span>
          </div>
          <span className="font-semibold text-sm">Knowledge HQ</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewChat}>
            <PlusIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      {conversations.length > 1 && (
        <div className="px-3 py-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full h-7 pl-7 pr-2 text-xs bg-sidebar-accent/30 rounded-md border-0 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
          </div>
        </div>
      )}

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {filteredConversations.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-muted-foreground">
                {search ? "No matching conversations" : "No conversations yet"}
              </p>
              {!search && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={handleNewChat}
              >
                Start your first chat
              </Button>
              )}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors",
                  activeConversationId === conv.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
                onClick={() => setActiveConversation(conv.id)}
                onMouseEnter={() => setHoveredId(conv.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <MessageIcon className="h-4 w-4 shrink-0 opacity-50" />
                <span className="truncate flex-1">{conv.title}</span>
                {hoveredId === conv.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-50 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeConversation(conv.id);
                      // Delete from DB
                      fetch(`/api/conversations/${conv.id}`, { method: "DELETE" }).catch(() => {});
                    }}
                  >
                    <XIcon className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))
          )}
          {/* Server search results (messages containing the search term) */}
          {serverOnlyResults.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Found in messages
                </span>
              </div>
              {serverOnlyResults.map((sr) => (
                <div
                  key={sr.conversationId}
                  className="px-3 py-2 rounded-md cursor-pointer text-sm transition-colors text-sidebar-foreground hover:bg-sidebar-accent/50"
                  onClick={() => {
                    setActiveConversation(sr.conversationId);
                    setSearch("");
                  }}
                >
                  <div className="flex items-center gap-2">
                    <SearchIcon className="h-3 w-3 shrink-0 opacity-50" />
                    <span className="truncate text-xs">{sr.title}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 ml-5 line-clamp-1">
                    {sr.matchPreview}
                  </p>
                </div>
              ))}
            </>
          )}
          {isSearching && (
            <div className="px-3 py-2 text-[10px] text-muted-foreground animate-pulse">
              Searching messages...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <SidebarFooter onOpenSettings={onOpenSettings} />
    </div>
  );
}

// Inline SVG icons to avoid heavy icon library dependency
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}

function NotificationBell() {
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; type: string; read: boolean; created_at: string }>>([]);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    fetch("/api/notifications")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setCount(d.unreadCount || 0);
          setNotifications(d.notifications || []);
        }
      })
      .catch(() => {});
  }, []);

  const markRead = () => {
    fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
    setCount(0);
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setShowPanel(!showPanel); if (!showPanel && count > 0) markRead(); }}
        className="relative text-muted-foreground hover:text-foreground transition-colors"
        title="Notifications"
      >
        <BellIcon className="h-3.5 w-3.5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full flex items-center justify-center">
            <span className="text-[7px] text-primary-foreground font-bold">{count}</span>
          </span>
        )}
      </button>
      {showPanel && (
        <div className="absolute bottom-8 left-0 w-64 bg-popover border border-border rounded-lg shadow-lg p-2 z-50">
          <div className="text-xs font-medium mb-2 px-1">Notifications</div>
          {notifications.length === 0 ? (
            <p className="text-[10px] text-muted-foreground px-1 py-2">No notifications</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {notifications.slice(0, 8).map(n => (
                <a
                  key={n.id}
                  href="/chat/teams"
                  className={cn(
                    "block px-2 py-1.5 rounded text-[10px] hover:bg-muted/50 transition-colors",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="text-muted-foreground mt-0.5">{n.body}</div>}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SidebarFooter({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { data: session } = useSession();

  return (
    <div className="p-3 border-t border-border space-y-1">
      {session?.user && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs">
          <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-primary">
              {session.user.name?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
          <span className="truncate flex-1 text-foreground">{session.user.name}</span>
          <NotificationBell />
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOutIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground">
        <BrainIcon className="h-4 w-4" />
        <span>Memory: Active</span>
      </div>
      <a
        href="/chat/teams"
        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors w-full"
      >
        <TeamIcon className="h-4 w-4" />
        <span>Teams</span>
      </a>
      <a
        href="/chat/analytics"
        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors w-full"
      >
        <ChartIcon className="h-4 w-4" />
        <span>Analytics</span>
      </a>
      <a
        href="/chat/graph"
        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors w-full"
      >
        <GraphIcon className="h-4 w-4" />
        <span>Knowledge Graph</span>
      </a>
      <button
        onClick={onOpenSettings}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors w-full"
      >
        <SettingsIcon className="h-4 w-4" />
        <span>Settings</span>
      </button>
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

function PanelLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" />
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
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

function GraphIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><path d="M8.6 7.4 15.4 16.6" /><path d="m15.4 7.4-6.8 3.2" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function TeamIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
