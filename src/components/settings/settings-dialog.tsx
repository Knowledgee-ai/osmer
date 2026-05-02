"use client";

import { useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { PROVIDER_NAMES, PROVIDER_COLORS } from "@/lib/ai/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getKnowledgeAtoms } from "@/lib/knowledge/store";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const PROVIDERS = [
  { id: "openrouter" as const, name: "OpenRouter", placeholder: "sk-or-v1-...", description: "Routes to all models. Recommended as fallback." },
  { id: "openai" as const, name: "OpenAI", placeholder: "sk-...", description: "GPT-4o, o3-mini, etc." },
  { id: "anthropic" as const, name: "Anthropic", placeholder: "sk-ant-...", description: "Claude Sonnet, Haiku, Opus" },
  { id: "google" as const, name: "Google", placeholder: "AIza...", description: "Gemini 2.5 Pro, Flash" },
  { id: "xai" as const, name: "xAI", placeholder: "xai-...", description: "Grok 3" },
];

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { apiKeys, setApiKey, removeApiKey } = useSettingsStore();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");

  const knowledgeCount = typeof window !== "undefined" ? getKnowledgeAtoms().length : 0;

  const handleSaveKey = (providerId: keyof typeof apiKeys) => {
    if (keyInput.trim()) {
      setApiKey(providerId, keyInput.trim());
    }
    setEditingKey(null);
    setKeyInput("");
  };

  const handleClearAllKnowledge = () => {
    if (confirm("Clear all extracted knowledge? This cannot be undone.")) {
      localStorage.removeItem("knowledgee-knowledge");
      window.location.reload();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* API Keys Section */}
          <div>
            <h3 className="text-sm font-medium mb-3">API Keys</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Add your own API keys for direct access. Keys with faster response
              times are used first; OpenRouter is used as fallback.
            </p>
            <div className="space-y-2">
              {PROVIDERS.map((provider) => {
                const hasKey = !!apiKeys[provider.id];
                const isEditing = editingKey === provider.id;

                return (
                  <div
                    key={provider.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:border-border transition-colors"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          PROVIDER_COLORS[provider.id] || "#888",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {provider.name}
                        </span>
                        {hasKey && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0"
                          >
                            Connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {provider.description}
                      </p>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={keyInput}
                          onChange={(e) => setKeyInput(e.target.value)}
                          placeholder={provider.placeholder}
                          className="h-7 text-xs w-48"
                          type="password"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveKey(provider.id);
                            if (e.key === "Escape") {
                              setEditingKey(null);
                              setKeyInput("");
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => handleSaveKey(provider.id)}
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setEditingKey(provider.id);
                            setKeyInput(apiKeys[provider.id] || "");
                          }}
                        >
                          {hasKey ? "Update" : "Add key"}
                        </Button>
                        {hasKey && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => removeApiKey(provider.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Knowledge Section */}
          <div>
            <h3 className="text-sm font-medium mb-3">Knowledge Base</h3>
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50">
              <div>
                <p className="text-sm">{knowledgeCount} knowledge atoms</p>
                <p className="text-[10px] text-muted-foreground">
                  Extracted from your conversations
                </p>
              </div>
              {knowledgeCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={handleClearAllKnowledge}
                >
                  Clear all
                </Button>
              )}
            </div>
          </div>

          {/* Data */}
          <div>
            <h3 className="text-sm font-medium mb-3">Data</h3>
            <div className="space-y-2">
            {/* Import */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50">
              <div>
                <p className="text-sm">Import conversations</p>
                <p className="text-[10px] text-muted-foreground">
                  Import from ChatGPT export (conversations.json)
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
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
                }}
              >
                Import
              </Button>
            </div>
            {/* Export */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50">
              <div>
                <p className="text-sm">Export all data</p>
                <p className="text-[10px] text-muted-foreground">
                  Download conversations, messages, and knowledge as JSON
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  window.open("/api/export", "_blank");
                }}
              >
                Download
              </Button>
            </div>
            </div>
          </div>

          {/* Appearance */}
          <div>
            <h3 className="text-sm font-medium mb-3">Appearance</h3>
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50">
              <div>
                <p className="text-sm">Theme</p>
                <p className="text-[10px] text-muted-foreground">
                  Choose dark or light mode
                </p>
              </div>
              <div className="flex gap-1">
                {(["dark", "light", "system"] as const).map((t) => (
                  <Button
                    key={t}
                    variant={useSettingsStore.getState().theme === t ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs capitalize"
                    onClick={() => useSettingsStore.getState().setTheme(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Knowledge HQ v0.1.0</span>
              <span>Your team&apos;s HQ for knowledgee</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
