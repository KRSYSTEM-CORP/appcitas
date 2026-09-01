"use client";

import { useState, useTransition, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markTourSeen } from "@/lib/actions/onboarding";

export type TourStep = {
  icon: ReactNode;
  title: string;
  description: string;
};

// First-time guided walkthrough, shown once right after a brand-new user's
// first login (see Session.hasSeenTour / markTourSeen) — a real multi-step
// tour of what each section does, rather than the single static blurb
// WelcomeModal shows on the (anonymous, pre-login) login page.
export function ProductTour({ steps }: { steps: TourStep[] }) {
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const [, startTransition] = useTransition();

  function finish() {
    setOpen(false);
    startTransition(() => {
      void markTourSeen();
    });
  }

  if (!open) return null;
  // Clamped defensively — setIndex already clamps on click, this just makes
  // sure a stray out-of-range index (e.g. steps changing size) can't crash
  // the render instead of just looking briefly odd.
  const safeIndex = Math.min(Math.max(index, 0), steps.length - 1);
  const step = steps[safeIndex];
  const isLast = safeIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10">
        <button
          type="button"
          onClick={finish}
          aria-label="Saltar el tutorial"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-5" />
        </button>

        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-4">
          {step.icon}
        </div>
        <h2 className="text-lg font-semibold mb-2">{step.title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{step.description}</p>

        <div className="flex items-center justify-center gap-1.5 mb-5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIndex ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {safeIndex > 0 && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            >
              Atrás
            </Button>
          )}
          {isLast ? (
            <Button type="button" className="flex-1" onClick={finish}>
              Empezar
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1"
              onClick={() => setIndex((i) => Math.min(i + 1, steps.length - 1))}
            >
              Siguiente
            </Button>
          )}
        </div>
        {!isLast && (
          <button
            type="button"
            onClick={finish}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-3"
          >
            Saltar tutorial
          </button>
        )}
      </div>
    </div>
  );
}
