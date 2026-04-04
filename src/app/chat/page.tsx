"use client";

import { useState, useCallback } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { KnowledgePanel } from "@/components/knowledge/knowledge-panel";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { useHydration } from "@/hooks/use-hydration";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useTheme } from "@/hooks/use-theme";

export default function ChatPage() {
  const hydrated = useHydration();
  useTheme(); // Apply theme from settings
  const [knowledgePanelOpen, setKnowledgePanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleKnowledge = useCallback(
    () => setKnowledgePanelOpen((prev) => !prev),
    []
  );
  const openSettings = useCallback(() => setSettingsOpen(true), []);

  useKeyboardShortcuts({
    onToggleKnowledge: toggleKnowledge,
    onOpenSettings: openSettings,
  });

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <AppSidebar onOpenSettings={openSettings} />
      <main className="flex-1 flex flex-col min-w-0">
        <ChatPanel onToggleKnowledge={toggleKnowledge} />
      </main>
      <KnowledgePanel
        open={knowledgePanelOpen}
        onClose={() => setKnowledgePanelOpen(false)}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
