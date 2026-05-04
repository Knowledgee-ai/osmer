"use client";

import { useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onStop?: () => void;
  /** Composition controls placed inside the aura, beneath the textarea
   *  — typically the model and audience pickers. */
  toolbar?: React.ReactNode;
  /** Optional meta line beside the italic caption — atoms / export /
   *  extracting status. Kept *outside* the aura so it doesn't compete
   *  with the composition. */
  metaRight?: React.ReactNode;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  onStop,
  toolbar,
  metaRight,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, [value]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) onSubmit();
    }
  };

  const canSend = !!value.trim() && !isLoading;

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-2xl px-8 pt-3 pb-4">
        <div className="osmer-aura">
          <div className="osmer-aura-inner flex flex-col gap-2 px-3.5 pt-2.5 pb-2">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the room…"
              className="min-h-[28px] max-h-[200px] resize-none border-0 bg-transparent p-0 text-[0.95rem] leading-[1.55] focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
              rows={1}
            />

            {/* Footer toolbar — composition controls on the left, send
             *  on the right. Lives inside the aura so the comet sweeps
             *  the whole composition area, not just the typing field. */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {toolbar}
              </div>

              {isLoading ? (
                <button
                  onClick={onStop}
                  aria-label="Stop generating"
                  className="mono inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 border border-border/80 text-foreground/80 hover:text-foreground hover:border-foreground/40 transition-colors"
                >
                  <span className="h-2 w-2 bg-[var(--clay)]" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  onClick={onSubmit}
                  disabled={!canSend}
                  aria-label="Send message"
                  className={cn(
                    "mono inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 border transition-colors",
                    canSend
                      ? "border-foreground bg-foreground text-background hover:bg-[var(--clay-deep)] hover:border-[var(--clay-deep)]"
                      : "border-border/60 text-muted-foreground/60 cursor-not-allowed"
                  )}
                >
                  <span>Send</span>
                  <ArrowEastIcon className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Caption row — left: italic line, right: optional meta */}
        <div className="mt-3 flex items-center justify-between gap-4 px-1">
          <p
            className="text-[0.7rem] tracking-[0.02em] text-muted-foreground/70"
            style={{ fontStyle: "italic", fontFamily: "var(--font-display), Georgia, serif" }}
          >
            Knowledge is extracted from conversations to build your organisation&rsquo;s memory.
          </p>
          {metaRight && (
            <div className="flex shrink-0 items-center gap-3">{metaRight}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArrowEastIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 7h10" /><path d="m8 3 4 4-4 4" />
    </svg>
  );
}
