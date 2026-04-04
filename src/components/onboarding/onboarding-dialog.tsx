"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  { key: "companyName", label: "What's your company name?", placeholder: "Acme Corp", icon: "\u{1F3E2}" },
  { key: "industry", label: "What industry are you in?", placeholder: "SaaS, Healthcare, Finance...", icon: "\u{1F4BC}" },
  { key: "role", label: "What's your role?", placeholder: "Software Engineer, Product Manager...", icon: "\u{1F464}" },
  { key: "techStack", label: "What's your tech stack?", placeholder: "React, Python, PostgreSQL, AWS...", icon: "\u{1F4BB}" },
  { key: "currentProjects", label: "What are you working on?", placeholder: "Building a new API, migrating to cloud...", icon: "\u{1F680}" },
];

export function OnboardingDialog({ open, onClose }: OnboardingDialogProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleSubmit();
    } else {
      setStep(step + 1);
    }
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

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            <span className="text-2xl block mb-2">{current?.icon}</span>
            Set up your knowledge base
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Progress */}
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Question */}
          <div className="space-y-3">
            <label className="text-sm font-medium">{current?.label}</label>
            <Input
              value={answers[current?.key || ""] || ""}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [current?.key || ""]: e.target.value }))
              }
              placeholder={current?.placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && answers[current?.key || ""]) {
                  handleNext();
                }
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip for now
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                disabled={loading}
              >
                {loading ? "Saving..." : isLast ? "Finish" : "Next"}
              </Button>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            This seeds your knowledge base so AI responses have context from day one.
            You can always add more later.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
