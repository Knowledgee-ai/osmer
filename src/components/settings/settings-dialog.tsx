"use client";

import { useSettingsStore } from "@/stores/settings-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getKnowledgeAtoms } from "@/lib/knowledge/store";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { theme, setTheme } = useSettingsStore();

  const knowledgeCount = typeof window !== "undefined" ? getKnowledgeAtoms().length : 0;

  const handleClearAllKnowledge = () => {
    if (confirm("Clear all extracted knowledge? This cannot be undone.")) {
      localStorage.removeItem("osmer-knowledge");
      window.location.reload();
    }
  };

  const importConversations = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, source: 'chatgpt' }),
        });
        const result = await res.json();
        alert(result.message || result.error || 'Import complete');
        window.location.reload();
      } catch {
        alert('Failed to parse file');
      }
    };
    input.click();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 border-border/80">
        <DialogHeader className="border-b border-border/60 px-7 pt-6 pb-5 space-y-2">
          <span className="mono text-muted-foreground/80">§ Settings</span>
          <DialogTitle
            className="text-[1.5rem] leading-[1.1] text-foreground font-normal"
            style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.022em" }}
          >
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="px-7 py-6 space-y-7">
          {/* Knowledge */}
          <Section label="Knowledge">
            <Row
              title={`${knowledgeCount} ${knowledgeCount === 1 ? "atom" : "atoms"}`}
              detail="Extracted from your conversations."
            >
              {knowledgeCount > 0 && (
                <button
                  onClick={handleClearAllKnowledge}
                  className="mono text-[var(--clay-deep)] hover:opacity-80 transition-opacity"
                >
                  Clear all
                </button>
              )}
            </Row>
          </Section>

          {/* Data */}
          <Section label="Data">
            <Row
              title="Import conversations"
              detail="ChatGPT export (conversations.json)."
            >
              <button
                onClick={importConversations}
                className="mono text-foreground/80 hover:text-foreground transition-colors"
              >
                Import →
              </button>
            </Row>
            <Row
              title="Export all data"
              detail="Download conversations, messages, and knowledge as JSON."
            >
              <button
                onClick={() => window.open("/api/export", "_blank")}
                className="mono text-foreground/80 hover:text-foreground transition-colors"
              >
                Download →
              </button>
            </Row>
          </Section>

          {/* Appearance */}
          <Section label="Appearance">
            <Row title="Theme" detail="Paper for light, ink for dark, or follow your system.">
              <div className="flex gap-1">
                {(["light", "dark", "system"] as const).map((t) => {
                  const active = theme === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={
                        active
                          ? "mono px-2.5 py-1 border border-foreground bg-foreground text-background transition-colors"
                          : "mono px-2.5 py-1 border border-border/60 text-foreground/80 hover:text-foreground hover:border-foreground/40 transition-colors"
                      }
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </Row>
          </Section>

          {/* About */}
          <div className="border-t border-border/60 pt-5 flex items-center justify-between mono text-muted-foreground/70">
            <span>Osmer · v0.1.0</span>
            <span className="text-muted-foreground/60">
              Models route through our gateway — no keys to manage.
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="mono text-muted-foreground/90">{label}</div>
      <div className="border-y border-border/60 divide-y divide-border/60 -mx-7">
        {children}
      </div>
    </section>
  );
}

function Row({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-7 py-4">
      <div className="min-w-0">
        <div className="text-[0.92rem] text-foreground leading-tight">{title}</div>
        <div className="text-[0.78rem] text-muted-foreground/80 mt-0.5">{detail}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
