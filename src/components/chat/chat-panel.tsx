"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useKnowledgeeChat } from "@/hooks/use-knowledgee-chat";
import { searchKnowledge, addKnowledgeAtoms, getKnowledgeAtoms } from "@/lib/knowledge/store";
import { exportConversationAsMarkdown, downloadMarkdown } from "@/lib/export";
import { ModelSelector } from "./model-selector";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { Badge } from "@/components/ui/badge";

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
    knowledgeMode,
  } = useChatStore();
  const { apiKeys } = useSettingsStore();

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
    if (knowledgeMode === "locked") return [];
    const query = input || "";
    const relevant = searchKnowledge(query, 8);
    return relevant.map((a) => a.content);
  }, [knowledgeMode, input]);

  // Filter to only non-empty API keys
  const activeKeys = useMemo(() => {
    const keys: Record<string, string> = {};
    for (const [k, v] of Object.entries(apiKeys)) {
      if (v) keys[k] = v;
    }
    return Object.keys(keys).length > 0 ? keys : undefined;
  }, [apiKeys]);

  const { messages, status, error, sendMessage, stop } = useKnowledgeeChat({
    conversationId: chatId,
    modelId: selectedModel,
    knowledgeContext: knowledgeContext.length > 0 ? knowledgeContext : undefined,
    apiKeys: activeKeys,
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
      if (knowledgeMode !== "locked") {
        triggerExtraction();
      }
      // Generate title after first exchange
      if (messages.length === 2) {
        const userMsg = messages[0]?.content || "";
        const aiMsg = messages[1]?.content || "";
        generateTitle(chatId, userMsg, aiMsg);
      }
    }
    prevStatusRef.current = status;
  }, [status, knowledgeMode, triggerExtraction, generateTitle, messages, chatId]);

  useEffect(() => {
    setKnowledgeCount(getKnowledgeAtoms().length);
  }, []);

  const createConversationIfNeeded = useCallback((messageText: string) => {
    if (!activeConversationId) {
      const title = messageText.slice(0, 50) + (messageText.length > 50 ? "..." : "");
      // Add to local state immediately
      addConversation({
        id: chatId,
        title,
        modelDefault: selectedModel,
        updatedAt: new Date().toISOString(),
      });
      setActiveConversation(chatId);
      // Persist to DB (fire-and-forget)
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chatId, title, modelDefault: selectedModel }),
      }).catch(() => {});
    }
  }, [activeConversationId, chatId, selectedModel, addConversation, setActiveConversation]);

  const onSubmit = () => {
    if (!input.trim() || isLoading) return;
    const messageText = input;
    setInput("");
    createConversationIfNeeded(messageText);
    sendMessage(messageText);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <ModelSelector />
          {knowledgeContext.length > 0 && !isLoading && (
            <Badge variant="secondary" className="text-[10px] gap-1 font-normal">
              <BrainIcon className="h-3 w-3" />
              {knowledgeContext.length} context
            </Badge>
          )}
          {extracting && (
            <span className="text-[10px] text-muted-foreground animate-pulse">
              Extracting knowledge...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => {
                const conv = useChatStore.getState().conversations.find(c => c.id === chatId);
                const title = conv?.title || "Conversation";
                const md = exportConversationAsMarkdown(title, messages);
                const filename = `${title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.md`;
                downloadMarkdown(md, filename);
              }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
              title="Export as markdown"
            >
              <DownloadIcon className="h-3 w-3" />
            </button>
          )}
          {knowledgeCount > 0 && (
            <button
              onClick={onToggleKnowledge}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
            >
              <BrainIcon className="h-3 w-3" />
              {knowledgeCount} atoms
            </button>
          )}
          <KnowledgeModeIndicator />
        </div>
      </div>

      {/* Messages */}
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

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={onSubmit}
        isLoading={isLoading}
        onStop={stop}
      />
    </div>
  );
}

function KnowledgeModeIndicator() {
  const { knowledgeMode, setKnowledgeMode } = useChatStore();

  const modes = [
    { value: "personal" as const, label: "Personal", icon: "\u{1F464}" },
    { value: "team" as const, label: "Team", icon: "\u{1F465}" },
    { value: "company" as const, label: "Company", icon: "\u{1F3E2}" },
    { value: "locked" as const, label: "Locked", icon: "\u{1F512}" },
  ];

  const current = modes.find((m) => m.value === knowledgeMode) || modes[0];

  return (
    <button
      onClick={() => {
        const idx = modes.findIndex((m) => m.value === knowledgeMode);
        const next = modes[(idx + 1) % modes.length];
        setKnowledgeMode(next.value);
      }}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
      title={`Knowledge mode: ${current.label}. Click to cycle.`}
    >
      <span>{current.icon}</span>
      <span>{current.label}</span>
    </button>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
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
