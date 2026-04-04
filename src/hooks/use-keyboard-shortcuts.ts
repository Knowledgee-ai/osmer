"use client";

import { useEffect } from "react";
import { useChatStore } from "@/stores/chat-store";

interface ShortcutHandlers {
  onToggleKnowledge?: () => void;
  onOpenSettings?: () => void;
}

export function useKeyboardShortcuts({
  onToggleKnowledge,
  onOpenSettings,
}: ShortcutHandlers) {
  const { setActiveConversation, setSidebarOpen, sidebarOpen } = useChatStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+N — New chat
      if (isMod && e.key === "n") {
        e.preventDefault();
        setActiveConversation(null);
      }

      // Cmd+B — Toggle sidebar
      if (isMod && e.key === "b") {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }

      // Cmd+Shift+K — Toggle knowledge panel
      if (isMod && e.shiftKey && e.key === "k") {
        e.preventDefault();
        onToggleKnowledge?.();
      }

      // Cmd+, — Open settings
      if (isMod && e.key === ",") {
        e.preventDefault();
        onOpenSettings?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setActiveConversation, setSidebarOpen, sidebarOpen, onToggleKnowledge, onOpenSettings]);
}
