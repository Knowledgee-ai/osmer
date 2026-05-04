"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useOsmerChat } from "@/hooks/use-osmer-chat";
import { searchKnowledge, addKnowledgeAtoms, getKnowledgeAtoms } from "@/lib/knowledge/store";
import { exportConversationAsMarkdown, downloadMarkdown } from "@/lib/export";
import { ModelSelector } from "./model-selector";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TeammatePicker } from "./teammate-picker";

interface ChatPanelProps {
  onToggleKnowledge?: () => void;
}

// Generate a new ID each time we need one
let pendingIdCounter = 0;
function generatePendingId() {
  return `pending-${++pendingIdCounter}-${crypto.randomUUID()}`;
}

export function ChatPanel({ onToggleKnowledge }: ChatPanelProps) {
  const {
    activeConversationId,
    selectedModel,
    updateConversationTitle,
    addConversation,
    setActiveConversation,
    conversations,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const lastExtractedRef = useRef<number>(0);

  // Pending ID for new conversations — resets when we click New Chat
  const [pendingId, setPendingId] = useState(generatePendingId);
  const chatId = activeConversationId || pendingId;

  // When activeConversationId becomes null (new chat), generate fresh pending ID
  const prevActiveIdRef = useRef(activeConversationId);
  useEffect(() => {
    if (prevActiveIdRef.current !== null && activeConversationId === null) {
      setPendingId(generatePendingId());
    }
    prevActiveIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Smart knowledge context
  const knowledgeContext = useMemo(() => {
    const query = input || "";
    const relevant = searchKnowledge(query, 8);
    return relevant.map((a) => a.content);
  }, [input]);

  const { messages, status, error, sendMessage, stop } = useOsmerChat({
    conversationId: chatId,
    modelId: selectedModel,
    knowledgeContext: knowledgeContext.length > 0 ? knowledgeContext : undefined,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Knowledge extraction
  const triggerExtraction = useCallback(async () => {
    const now = Date.now();
    if (now - lastExtractedRef.current < 10000) return;
    lastExtractedRef.current = now;
    if (messages.length < 2) return;

    setExtracting(true);
    try {
      const response = await fetch("/api/knowledge/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          conversationId: chatId,
        }),
      });
      if (response.ok) {
        const { atoms } = await response.json();
        if (atoms?.length > 0) {
          addKnowledgeAtoms(atoms);
          setKnowledgeCount(getKnowledgeAtoms().length);
        }
      }
    } catch (err) {
      console.error("Knowledge extraction failed:", err);
    } finally {
      setExtracting(false);
    }
  }, [messages, chatId]);

  // Auto-generate title after first AI response
  const titleGeneratedRef = useRef<Set<string>>(new Set());
  const generateTitle = useCallback(async (conversationId: string, userMessage: string, aiResponse: string) => {
    if (titleGeneratedRef.current.has(conversationId)) return;
    titleGeneratedRef.current.add(conversationId);

    try {
      const response = await fetch("/api/chat/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage, aiResponse }),
      });
      if (response.ok) {
        const { title } = await response.json();
        if (title) {
          updateConversationTitle(conversationId, title);
          // Persist to DB
          fetch(`/api/conversations/${conversationId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          }).catch(() => {});
        }
      }
    } catch {
      // Title generation is best-effort
    }
  }, [updateConversationTitle]);

  // Trigger extraction + title generation when streaming completes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current === "streaming" && status === "ready") {
      triggerExtraction();
      // Generate title after first exchange
      if (messages.length === 2) {
        const userMsg = messages[0]?.content || "";
        const aiMsg = messages[1]?.content || "";
        generateTitle(chatId, userMsg, aiMsg);
      }
    }
    prevStatusRef.current = status;
  }, [status, triggerExtraction, generateTitle, messages, chatId]);

  useEffect(() => {
    setKnowledgeCount(getKnowledgeAtoms().length);
  }, []);

  const createConversationIfNeeded = useCallback((messageText: string) => {
    if (!activeConversationId) {
      const title = messageText.slice(0, 50) + (messageText.length > 50 ? "..." : "");
      const pendingEntry = conversations.find((c) => c.id === chatId);
      const visibility = pendingEntry?.visibility ?? 'private';
      const teamId = pendingEntry?.teamId ?? null;
      // Add to local state immediately (or keep existing pending entry if user already set audience)
      if (!pendingEntry) {
        addConversation({
          id: chatId,
          title,
          modelDefault: selectedModel,
          updatedAt: new Date().toISOString(),
          visibility,
          teamId,
        });
      } else {
        updateConversationTitle(chatId, title);
      }
      setActiveConversation(chatId);
      // Persist to DB (fire-and-forget)
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chatId, title, modelDefault: selectedModel, visibility, teamId }),
      }).catch(() => {});
    }
  }, [activeConversationId, chatId, selectedModel, conversations, addConversation, updateConversationTitle, setActiveConversation]);

  const onSubmit = () => {
    if (!input.trim() || isLoading) return;
    const messageText = input;
    setInput("");
    createConversationIfNeeded(messageText);
    sendMessage(messageText);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages — fills the surface; no top bar to compete */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        error={error}
        onSendPrompt={(text) => {
          setInput(text);
          setTimeout(() => {
            setInput("");
            createConversationIfNeeded(text);
            sendMessage(text);
          }, 100);
        }}
      />

      {/* Input — composition controls live inside the aura;
       *  conversation meta sits beside the italic caption. */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={onSubmit}
        isLoading={isLoading}
        onStop={stop}
        toolbar={
          <>
            <ModelSelector />
            <span className="h-3 w-px bg-border/80 shrink-0" aria-hidden />
            <ConversationAudienceSelector chatId={chatId} />
            {knowledgeContext.length > 0 && !isLoading && (
              <span className="mono text-muted-foreground/80 hidden md:inline">
                {knowledgeContext.length} in context
              </span>
            )}
          </>
        }
        metaRight={
          <>
            {extracting && (
              <span className="mono text-muted-foreground/70 animate-pulse">
                Extracting…
              </span>
            )}
            {knowledgeCount > 0 && (
              <button
                onClick={onToggleKnowledge}
                className="mono inline-flex items-center gap-1.5 text-muted-foreground/80 hover:text-foreground transition-colors"
              >
                <span>Atoms</span>
                <span className="text-foreground/80">{knowledgeCount}</span>
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={() => {
                  const conv = useChatStore.getState().conversations.find(c => c.id === chatId);
                  const title = conv?.title || "Conversation";
                  const md = exportConversationAsMarkdown(title, messages);
                  const filename = `${title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.md`;
                  downloadMarkdown(md, filename);
                }}
                className="mono text-muted-foreground/80 hover:text-foreground transition-colors"
                title="Export as markdown"
              >
                Export
              </button>
            )}
          </>
        }
      />
    </div>
  );
}

function ConversationAudienceSelector({ chatId }: { chatId: string }) {
  const { conversations, setConversationAudience } = useChatStore();
  const conv = conversations.find((c) => c.id === chatId);
  const visibility = conv?.visibility ?? 'private';
  const isPersisted = Boolean(conv) && !chatId.startsWith('pending-');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [inviteCount, setInviteCount] = useState(0);

  // Refresh invite count when this becomes a real conversation
  useEffect(() => {
    if (!isPersisted || visibility !== 'team') return;
    fetch(`/api/conversations/${chatId}/participants`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.participants) setInviteCount(d.participants.length);
      })
      .catch(() => {});
  }, [chatId, isPersisted, visibility]);

  const setAudience = (vis: 'private' | 'team' | 'organization') => {
    setConversationAudience(chatId, vis, null);
    if (isPersisted) {
      fetch(`/api/conversations/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: vis }),
      }).catch(() => {});
    }
  };

  const onSelectTeam = () => {
    setAudience('team');
    if (isPersisted) setPickerOpen(true);
  };

  const currentLabel =
    visibility === 'private'
      ? 'Just you'
      : visibility === 'organization'
        ? 'Entire organization'
        : inviteCount > 0
          ? `${inviteCount} team member${inviteCount === 1 ? '' : 's'}`
          : 'Add team member';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-2 whitespace-nowrap text-[0.82rem] text-foreground hover:text-[var(--clay-deep)] transition-colors focus-visible:outline-none">
          <AudienceIcon visibility={visibility} className="h-3 w-3 opacity-70" />
          <span style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.012em" }}>
            {currentLabel}
          </span>
          <ChevronDownIcon className="h-3 w-3 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <div className="px-1.5 pt-1.5 pb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-normal">
            Conversation audience
          </div>
          <DropdownMenuItem
            onClick={() => setAudience('private')}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <AudienceIcon visibility="private" className="h-3.5 w-3.5 opacity-70" />
              <div className="flex flex-col">
                <span className="text-sm">Just you</span>
                <span className="text-[10px] text-muted-foreground">Private — only you can see this thread</span>
              </div>
            </div>
            {visibility === 'private' && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onSelectTeam}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <AudienceIcon visibility="team" className="h-3.5 w-3.5 opacity-70" />
              <div className="flex flex-col">
                <span className="text-sm">Add team member</span>
                <span className="text-[10px] text-muted-foreground">
                  {visibility === 'team' && inviteCount > 0
                    ? `${inviteCount} invited · click to manage`
                    : 'Invite specific people to collaborate'}
                </span>
              </div>
            </div>
            {visibility === 'team' && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setAudience('organization')}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <AudienceIcon visibility="organization" className="h-3.5 w-3.5 opacity-70" />
              <div className="flex flex-col">
                <span className="text-sm">Make available to entire organization</span>
                <span className="text-[10px] text-muted-foreground">Anyone in your company can read and chime in</span>
              </div>
            </div>
            {visibility === 'organization' && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TeammatePicker
        open={pickerOpen}
        conversationId={chatId}
        onClose={() => setPickerOpen(false)}
        onChange={setInviteCount}
      />
    </>
  );
}

function AudienceIcon({ visibility, className }: { visibility: 'private' | 'team' | 'organization'; className?: string }) {
  if (visibility === 'private') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }
  if (visibility === 'team') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" /><path d="M16 6h.01" />
      <path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" />
      <path d="M16 10h.01" /><path d="M16 14h.01" />
      <path d="M8 10h.01" /><path d="M8 14h.01" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

