"use client";

// MSIH CRM V1.0 — Onboarding tour (first-time-user walkthrough)
// 6-step spotlight+popover tour. No external deps (no react-joyride / driver.js).
// State lives in the shared `useUI` Zustand store so the Header's "Take Tour"
// button and this component stay in sync.
// Developer: Manoj Dore — MIT License

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useUI,
  TOUR_TOTAL_STEPS,
  TOUR_STORAGE_KEY,
} from "@/lib/store";
import type { ViewKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
} from "lucide-react";

/* ---------- helpers ---------- */

/** Find the first <tag> whose trimmed textContent exactly matches `text`. */
function findElWithText<T extends HTMLElement>(
  tag: string,
  text: string,
): T | null {
  const els = Array.from(document.querySelectorAll<T>(tag));
  return (
    els.find((el) => (el.textContent ?? "").trim() === text) ??
    els.find((el) => (el.textContent ?? "").includes(text)) ??
    null
  );
}

/** Find a visible element (non-zero rect) whose textContent includes `text`. */
function findVisibleWithText<T extends HTMLElement>(
  tag: string,
  text: string,
): T | null {
  const els = Array.from(document.querySelectorAll<T>(tag));
  return (
    els.find((el) => {
      if (!(el.textContent ?? "").includes(text)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) ?? null
  );
}

/* ---------- tour step model ---------- */

type StepKind = "modal" | "spotlight";

interface TourStep {
  kind: StepKind;
  title: string;
  description: string;
  /** Navigate to this view before showing the step. */
  view?: ViewKey;
  /** For spotlight steps: a function that resolves the target element. */
  target?: () => HTMLElement | null;
  /** Custom label for the primary button. */
  cta?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    kind: "modal",
    title: "Welcome to MSIH CRM \u{1F44B}",
    description:
      "MetTechnik Sales Intelligence Hub. Let's take a 60-second tour of the key features. You can skip anytime.",
    view: "dashboard",
    cta: "Start Tour",
  },
  {
    kind: "spotlight",
    title: "Sidebar Navigation",
    description:
      "Use the sidebar to switch between 23 views \u2014 Dashboard, Enquiries, Quotations, Customers, Tasks, and more.",
    view: "dashboard",
    target: () =>
      document.querySelector<HTMLElement>("[data-tour='sidebar-nav']"),
  },
  {
    kind: "spotlight",
    title: "New Enquiry",
    description:
      "Click here to capture a new lead in under 2 minutes \u2014 company, contact, product interest, and lead score.",
    view: "enquiries",
    target: () => findVisibleWithText<HTMLButtonElement>("button", "New Enquiry"),
  },
  {
    kind: "spotlight",
    title: "Saved Views",
    description:
      "Save your favorite filter combinations as named views. They persist across sessions and can be set as default.",
    view: "enquiries",
    target: () => {
      // The SavedViewsBar exposes a <span>Views</span> label two levels below
      // the bar container. We don't own the enquiries-view file, so resolve
      // via text content rather than a data-tour attribute.
      const span = findElWithText<HTMLElement>("span", "Views");
      if (!span) return null;
      return (
        span.parentElement?.parentElement ??
        span.parentElement ??
        span
      );
    },
  },
  {
    kind: "spotlight",
    title: "Notifications",
    description:
      "Recent activity across the CRM \u2014 audit logs, bulk actions, transfers. Live-updates every 60 seconds.",
    // Notifications bell is in the header (always visible) — no view change.
    target: () =>
      document.querySelector<HTMLElement>("[data-tour='notifications-bell']"),
  },
  {
    kind: "modal",
    title: "Keyboard Shortcuts",
    description:
      "Press ? anytime to see all keyboard shortcuts. \u2318K opens the command palette. G then E jumps to Enquiries.",
    cta: "Finish Tour",
  },
];

/* ---------- hook ---------- */

export interface UseOnboarding {
  isTourActive: boolean;
  tourStep: number;
  startTour: () => void;
  dismissTour: () => void;
  completeTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
}

/**
 * Convenience selector around the tour slice of `useUI`. Components that need
 * to trigger the tour (e.g. the Header's "Take Tour" menu item) should use
 * this hook to avoid re-rendering on unrelated store changes.
 */
export function useOnboarding(): UseOnboarding {
  const isTourActive = useUI((s) => s.tourActive);
  const tourStep = useUI((s) => s.tourStep);
  const startTour = useUI((s) => s.startTour);
  const dismissTour = useUI((s) => s.dismissTour);
  const completeTour = useUI((s) => s.completeTour);
  const nextTourStep = useUI((s) => s.nextTourStep);
  const prevTourStep = useUI((s) => s.prevTourStep);
  return {
    isTourActive,
    tourStep,
    startTour,
    dismissTour,
    completeTour,
    nextTourStep,
    prevTourStep,
  };
}

/* ---------- popover placement math ---------- */

type Placement = "right" | "left" | "below" | "above";

interface PopoverPos {
  top: number;
  left: number;
  placement: Placement;
}

const POPOVER_W = 340;
const POPOVER_H_EST = 220; // estimate; popover clamps itself
const GAP = 14;
const VP_PAD = 16;

function computePopoverPos(rect: DOMRect): PopoverPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Default: place to the right, vertically centered on the target.
  let placement: Placement = "right";
  let top = rect.top + rect.height / 2 - POPOVER_H_EST / 2;
  let left = rect.right + GAP;

  if (left + POPOVER_W > vw - VP_PAD) {
    // Not enough room on the right → try the left.
    placement = "left";
    left = rect.left - POPOVER_W - GAP;
    if (left < VP_PAD) {
      // Not enough room on the left either → drop below.
      placement = "below";
      left = Math.max(VP_PAD, Math.min(rect.left, vw - POPOVER_W - VP_PAD));
      top = rect.bottom + GAP;
      if (top + POPOVER_H_EST > vh - VP_PAD) {
        // No room below → place above.
        placement = "above";
        top = rect.top - POPOVER_H_EST - GAP;
      }
    }
  }

  // Clamp vertically.
  top = Math.max(VP_PAD, Math.min(top, vh - POPOVER_H_EST - VP_PAD));
  return { top, left, placement };
}

/* ---------- component ---------- */

export function OnboardingTour() {
  const tourActive = useUI((s) => s.tourActive);
  const tourStep = useUI((s) => s.tourStep);
  const setView = useUI((s) => s.setView);
  const dismissTour = useUI((s) => s.dismissTour);
  const completeTour = useUI((s) => s.completeTour);
  const nextTourStep = useUI((s) => s.nextTourStep);
  const prevTourStep = useUI((s) => s.prevTourStep);

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [popoverPos, setPopoverPos] = useState<PopoverPos | null>(null);

  // Auto-start on first ever visit: if the localStorage flag is unset, kick
  // off the tour after a short delay so the app shell finishes rendering.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let flag: string | null = null;
    try {
      flag = window.localStorage.getItem(TOUR_STORAGE_KEY);
    } catch {
      return; // localStorage unavailable — bail out silently
    }
    if (flag !== null) return;
    const t = window.setTimeout(() => {
      useUI.getState().startTour();
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);

  // Before each step, navigate to the step's target view (if any). We do this
  // unconditionally on every step change so the spotlight target is in the DOM.
  useEffect(() => {
    if (!tourActive) return;
    const s = TOUR_STEPS[tourStep];
    if (s?.view) {
      setView(s.view);
    }
  }, [tourActive, tourStep, setView]);

  // For spotlight steps, re-query the target element after a short delay (the
  // view transition needs a beat to mount the target). Recompute the popover
  // position based on the target's bounding rect.
  useEffect(() => {
    if (!tourActive) return;
    // Reset the cached target rect + popover pos so we don't briefly show a
    // stale spotlight from the previous step. (Disabled lint rule: setState
    // in effect is intentional here — we're clearing derived geometry.)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetRect(null);
    setPopoverPos(null);
    const s = TOUR_STEPS[tourStep];
    if (s?.kind !== "spotlight") return;

    const t = window.setTimeout(() => {
      const el = s.target?.();
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // If the element has zero size (hidden), give up gracefully.
      if (rect.width === 0 || rect.height === 0) return;
      setTargetRect(rect);
      setPopoverPos(computePopoverPos(rect));
    }, 350);

    return () => window.clearTimeout(t);
  }, [tourActive, tourStep]);

  // Recompute the spotlight rect on scroll / resize so the cut-out tracks the
  // target. (Popover position recomputes too — the target may have moved.)
  useEffect(() => {
    if (!tourActive) return;
    const s = TOUR_STEPS[tourStep];
    if (s?.kind !== "spotlight") return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = s.target?.();
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        setTargetRect(rect);
        setPopoverPos(computePopoverPos(rect));
      });
    };

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [tourActive, tourStep]);

  // Keyboard navigation: Escape dismisses, ArrowRight/Left move between steps.
  // Attached in the CAPTURE phase so we can stop propagation before the global
  // shortcut handler in app-shell.tsx sees the keypress (e.g. "?" would
  // otherwise open the shortcuts dialog behind the tour overlay).
  useEffect(() => {
    if (!tourActive) return;
    const onKey = (e: KeyboardEvent) => {
      // Don't intercept when the user is typing in an input/textarea.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        dismissTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        nextTourStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        prevTourStep();
      }
    };
    window.addEventListener("keydown", onKey, true); // capture
    return () => window.removeEventListener("keydown", onKey, true);
  }, [tourActive, dismissTour, nextTourStep, prevTourStep]);

  if (!tourActive) return null;

  const step = TOUR_STEPS[tourStep];
  const isFirst = tourStep === 0;
  const isLast = tourStep === TOUR_TOTAL_STEPS - 1;

  // ---------- centered modal (welcome / final) ----------
  if (step.kind === "modal") {
    return (
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-modal-title"
        aria-describedby="tour-modal-desc"
      >
        <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
          <button
            type="button"
            onClick={dismissTour}
            aria-label="Skip tour"
            className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Sparkles className="h-6 w-6" />
          </div>

          <h3
            id="tour-modal-title"
            className="text-xl font-bold tracking-tight text-foreground"
          >
            {step.title}
          </h3>
          <p
            id="tour-modal-desc"
            className="mt-2 text-sm leading-relaxed text-muted-foreground"
          >
            {step.description}
          </p>

          <ProgressDots current={tourStep} />

          <div className="mt-6 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Step {tourStep + 1} of {TOUR_TOTAL_STEPS}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissTour}
                aria-label="Skip tour"
              >
                Skip tour
              </Button>
              {!isFirst && (
                <Button variant="ghost" size="sm" onClick={prevTourStep}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              )}
              <Button size="sm" onClick={isLast ? completeTour : nextTourStep}>
                {isLast ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    {step.cta ?? "Finish"}
                  </>
                ) : (
                  <>
                    {step.cta ?? "Next"}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- spotlight + popover ----------
  // If the target element hasn't resolved yet (e.g. mid view-transition) we
  // render a soft dim overlay so the user sees the tour is active. Once the
  // target resolves, the spotlight cut-out and popover replace this.
  if (!targetRect || !popoverPos) {
    return (
      <div
        className="fixed inset-0 z-[120] bg-black/40"
        role="dialog"
        aria-modal="true"
        aria-label={`Onboarding tour — step ${tourStep + 1}: ${step.title}`}
      />
    );
  }

  const PAD = 8;
  const spotTop = Math.max(0, targetRect.top - PAD);
  const spotLeft = Math.max(0, targetRect.left - PAD);
  const spotW = targetRect.width + PAD * 2;
  const spotH = targetRect.height + PAD * 2;

  return (
    <div
      className="fixed inset-0 z-[120]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-popover-title"
      aria-describedby="tour-popover-desc"
    >
      {/* Click-away overlay: clicking outside the popover dismisses the tour.
          Sits behind the spotlight div so the box-shadow paints the dim. */}
      <button
        type="button"
        aria-label="Skip tour"
        tabIndex={-1}
        className="absolute inset-0 cursor-default focus:outline-none"
        onClick={dismissTour}
      />

      {/* Spotlight: a transparent div positioned over the target with a
          massive box-shadow that paints the dim around it. The 2px ring
          gives a crisp border in the primary (industrial-blue) color. */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-200 ease-out"
        style={{
          top: `${spotTop}px`,
          left: `${spotLeft}px`,
          width: `${spotW}px`,
          height: `${spotH}px`,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
        }}
      />

      {/* Popover tooltip */}
      <div
        role="document"
        className="absolute w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-4 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header row: step badge + close */}
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex h-6 items-center rounded-md bg-primary/10 px-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Step {tourStep + 1} / {TOUR_TOTAL_STEPS}
          </span>
          <button
            type="button"
            onClick={dismissTour}
            aria-label="Skip tour"
            className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <h3
          id="tour-popover-title"
          className="text-base font-bold tracking-tight text-foreground"
        >
          {step.title}
        </h3>
        <p
          id="tour-popover-desc"
          className="mt-1.5 text-sm leading-relaxed text-muted-foreground"
        >
          {step.description}
        </p>

        <ProgressDots current={tourStep} compact />

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={dismissTour}
            className="text-muted-foreground"
            aria-label="Skip tour"
          >
            Skip
          </Button>
          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={prevTourStep}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Prev
              </Button>
            )}
            <Button size="sm" onClick={isLast ? completeTour : nextTourStep}>
              {isLast ? (
                <>
                  <Check className="mr-1 h-4 w-4" /> Finish
                </>
              ) : (
                <>
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- progress dots ---------- */

function ProgressDots({
  current,
  compact = false,
}: {
  current: number;
  compact?: boolean;
}) {
  return (
    <div
      className={cn("flex items-center gap-1.5", compact ? "mt-3" : "mt-5")}
      role="presentation"
      aria-hidden
    >
      {Array.from({ length: TOUR_TOTAL_STEPS }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-200",
            i === current
              ? "w-6 bg-primary"
              : i < current
                ? "w-1.5 bg-primary/50"
                : "w-1.5 bg-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}
