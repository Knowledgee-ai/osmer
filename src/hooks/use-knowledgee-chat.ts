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
  apiKeys?: Record<string, string>;
}

export function useKnowledgeeChat({
  conversationId,
  modelId,
  knowledgeContext,
  apiKeys,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<StoredMessage[]>(() =>
    getMessages(conversationId)
  );
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef(conversationId);

  // When conversation changes, load its messages
  useEffect(() => {
    if (conversationId !== conversationIdRef.current) {
      conversationIdRef.current = conversationId;
      const stored = getMessages(conversationId);
      setMessages(stored);
      setStatus("ready");
      setError(undefined);
    }
  }, [conversationId]);

  // Persist messages whenever they change
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

      // Add user message
      const userMessage: StoredMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setStatus("submitted");

      // Prepare the request
      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        // Pass BYOK API keys as a header
        if (apiKeys && Object.keys(apiKeys).length > 0) {
          headers["x-api-keys"] = btoa(JSON.stringify(apiKeys));
        }

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

        // Parse the UI message stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        const assistantId = crypto.randomUUID();

        // Add empty assistant message that we'll update
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

          // Parse SSE lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

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
              // Skip unparseable lines (start/finish markers, etc.)
              if (e instanceof Error && e.message !== "Stream error" && !e.message.includes("JSON")) {
                throw e;
              }
            }
          }
        }

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
    [messages, modelId, conversationId, knowledgeContext, apiKeys]
  );

  return { messages, status, error, sendMessage, stop };
}
