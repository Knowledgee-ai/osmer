"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getMessages, saveMessages, type StoredMessage } from "@/lib/messages/store";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export interface UseChatReturn {
  messages: StoredMessage[];
  status: ChatStatus;
  error: Error | undefined;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
}

interface UseChatOptions {
  conversationId: string;
  modelId: string;
  knowledgeContext?: string[];
}

// Persist a message to the DB (fire-and-forget)
function persistMessageToDb(conversationId: string, msg: StoredMessage) {
  fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      modelUsed: msg.modelUsed,
    }),
  }).catch(() => {
    // DB persistence is best-effort — localStorage is the fallback
  });
}

export function useOsmerChat({
  conversationId,
  modelId,
  knowledgeContext,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<StoredMessage[]>(() =>
    getMessages(conversationId)
  );
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef(conversationId);

  // When conversation changes, load messages (try DB first, fall back to localStorage)
  useEffect(() => {
    if (conversationId !== conversationIdRef.current) {
      conversationIdRef.current = conversationId;

      // Immediately show localStorage cache
      const cached = getMessages(conversationId);
      setMessages(cached);
      setStatus("ready");
      setError(undefined);

      // Then try to load from DB (fresher data)
      fetch(`/api/conversations/${conversationId}/messages`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.messages?.length > 0 && conversationIdRef.current === conversationId) {
            const dbMessages: StoredMessage[] = data.messages.map((m: { id: string; role: string; content: string; modelUsed: string | null; createdAt: string; userId?: string | null; senderName?: string | null }) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              modelUsed: m.modelUsed || undefined,
              createdAt: m.createdAt,
              userId: m.userId ?? null,
              senderName: m.senderName ?? null,
            }));
            setMessages(dbMessages);
            saveMessages(conversationId, dbMessages); // Update cache
          }
        })
        .catch(() => {}); // Silently fall back to cache
    }
  }, [conversationId]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(conversationId, messages);
    }
  }, [messages, conversationId]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("ready");
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      setError(undefined);

      const userMessage: StoredMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setStatus("submitted");

      // Persist user message to DB
      persistMessageToDb(conversationId, userMessage);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        const response = await fetch("/api/chat", {
          method: "POST",
          headers,
          signal: abortController.signal,
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              parts: [{ type: "text", text: m.content }],
            })),
            modelId,
            conversationId,
            knowledgeContext,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        setStatus("streaming");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        const assistantId = crypto.randomUUID();

        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: "",
            modelUsed: modelId,
            createdAt: new Date().toISOString(),
          },
        ]);

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "text-delta" && parsed.delta) {
                assistantContent += parsed.delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              } else if (parsed.type === "error") {
                throw new Error(parsed.errorText || "Stream error");
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Stream error" && !e.message.includes("JSON")) {
                throw e;
              }
            }
          }
        }

        // Persist completed assistant message to DB
        persistMessageToDb(conversationId, {
          id: assistantId,
          role: "assistant",
          content: assistantContent,
          modelUsed: modelId,
          createdAt: new Date().toISOString(),
        });

        setStatus("ready");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setStatus("ready");
          return;
        }
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [messages, modelId, conversationId, knowledgeContext]
  );

  return { messages, status, error, sendMessage, stop };
}
