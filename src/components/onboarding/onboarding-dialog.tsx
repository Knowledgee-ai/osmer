"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OnboardingDialogProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  { key: "companyName", label: "Company name", placeholder: "Acme Corp" },
  { key: "industry", label: "Industry", placeholder: "SaaS, Healthcare, Finance…" },
  { key: "role", label: "Your role", placeholder: "Engineer, PM, Designer…" },
  { key: "techStack", label: "Tech stack", placeholder: "React, Python, PostgreSQL, AWS…" },
  { key: "currentProjects", label: "Current projects", placeholder: "API rewrite, cloud migration…" },
];

export function OnboardingDialog({ open, onClose }: OnboardingDialogProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const stepIndex = String(step + 1).padStart(2, "0");
  const total = String(STEPS.length).padStart(2, "0");

  const handleNext = () => {
    if (isLast) handleSubmit();
    else setStep(step + 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
    } catch {}
    setLoading(false);
    onClose();
  };

  const handleSkip = () => onClose();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 border-border/80">
        <DialogHeader className="border-b border-border/60 px-7 pt-6 pb-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="mono text-muted-foreground/80">
              § Setup · {stepIndex} / {total}
            </span>
            <span className="mono text-muted-foreground/60">Plate I</span>
          </div>
          <DialogTitle
            className="text-[1.5rem] leading-[1.1] text-foreground font-normal"
            style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.022em" }}
          >
            Seed your knowledge base.
          </DialogTitle>
        </DialogHeader>

        <div className="px-7 py-6 space-y-6">
          {/* Progress rail — five hairline ticks */}
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-px flex-1 transition-colors ${
                  i <= step ? "bg-foreground" : "bg-border/60"
                }`}
              />
            ))}
          </div>

          {/* Question */}
          <div className="space-y-2.5">
            <label
              className="block mono text-muted-foreground/90"
              htmlFor={current?.key}
            >
              {current?.label}
            </label>
            <Input
              id={current?.key}
              value={answers[current?.key || ""] || ""}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [current?.key || ""]: e.target.value }))
              }
              placeholder={current?.placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && answers[current?.key || ""]) handleNext();
              }}
              className="h-10 text-[0.95rem]"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border/60 -mx-7 px-7 mt-7 pt-5">
            <button
              onClick={handleSkip}
              className="mono text-muted-foreground/80 hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
            <div className="flex items-center gap-4">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="mono text-muted-foreground/80 hover:text-foreground transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={loading}
                className="mono inline-flex items-center gap-1.5 border border-foreground bg-foreground px-3 py-1.5 text-background transition-colors hover:bg-[var(--clay-deep)] hover:border-[var(--clay-deep)] disabled:opacity-60"
              >
                <span>{loading ? "Saving…" : isLast ? "Finish" : "Next"}</span>
                {!loading && <ArrowEastIcon className="h-2.5 w-2.5" />}
              </button>
            </div>
          </div>

          <p className="mono text-muted-foreground/60 text-center pt-1">
            Seeds your memory so the room remembers from day one.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArrowEastIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 7h10" /><path d="m8 3 4 4-4 4" />
    </svg>
  );
}
