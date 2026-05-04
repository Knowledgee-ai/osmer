"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Wraps the chat shell with a dynamic `data-theme` attribute (paper or
 * ink) driven by the user's settings. The setting is persisted in the
 * settings store; "system" follows the OS preference and updates live
 * if the OS theme changes mid-session. The landing site is unaffected
 * — only the workspace flips.
 */
export function ChatThemeShell({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme);
  const [resolved, setResolved] = useState<"paper" | "ink">("paper");

  useEffect(() => {
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      setResolved(mq.matches ? "ink" : "paper");
      const handler = (e: MediaQueryListEvent) => setResolved(e.matches ? "ink" : "paper");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    setResolved(theme === "dark" ? "ink" : "paper");
  }, [theme]);

  return (
    <div data-theme={resolved} className="h-full bg-background text-foreground">
      {children}
    </div>
  );
}
