"use client";

// MSIH CRM V1.0 — Mobile Pull-to-Refresh
// Wraps a scroll container; on touch devices, pulling down past the top
// triggers an async refresh. On non-touch devices it renders children
// inside a plain div so the parent main element scrolls normally.
// Developer: Manoj Dore — MIT License

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowDownCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const THRESHOLD = 70; // px pull that triggers refresh
const MAX_PULL = 120; // max rubber-band pull (px)
const REFRESH_MIN_DELAY = 600; // ms — minimum UX delay for smooth feel

export function PullToRefresh({
  onRefresh,
  children,
  className,
}: {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    // Detect touch capability — only enable pull-to-refresh on touch devices
    const touch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    setIsTouch(touch);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      const el = containerRef.current;
      // Only start pull tracking when the container is scrolled to top
      if (!el || el.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
    },
    [refreshing]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startYRef.current === null || refreshing) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      // Rubber-band easing past the threshold
      const eased =
        delta > THRESHOLD
          ? THRESHOLD + (delta - THRESHOLD) * 0.4
          : delta;
      const clamped = Math.min(eased, MAX_PULL);
      setPull(clamped);
      // Prevent default scroll only while actively pulling
      if (delta > 4) e.preventDefault();
    },
    [refreshing]
  );

  const onTouchEnd = useCallback(async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;

    if (pull >= THRESHOLD) {
      setRefreshing(true);
      try {
        await Promise.all([
          onRefresh(),
          new Promise((r) => setTimeout(r, REFRESH_MIN_DELAY)),
        ]);
      } finally {
        setRefreshing(false);
      }
    }
    setPull(0);
  }, [pull, onRefresh, refreshing]);

  const showIndicator = pull > 0 || refreshing;
  const progress = Math.min(pull / THRESHOLD, 1);
  const thresholdReached = pull >= THRESHOLD;
  const indicatorOffset = refreshing ? THRESHOLD : pull;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        // Only act as a scroll container on touch devices — on desktop the
        // parent <main> handles scrolling, which keeps the layout simple.
        isTouch && "overflow-y-auto",
        className
      )}
      onTouchStart={isTouch ? onTouchStart : undefined}
      onTouchMove={isTouch ? onTouchMove : undefined}
      onTouchEnd={isTouch ? onTouchEnd : undefined}
      role="region"
      aria-label="Pull to refresh"
    >
      {showIndicator && (
        <div
          className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-full border border-border/60 bg-card/80 p-2 shadow-lg backdrop-blur"
          style={{ top: `${indicatorOffset - 44}px` }}
          aria-hidden
        >
          {refreshing ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <ArrowDownCircle
              className="h-5 w-5 text-muted-foreground"
              style={{
                transform: `rotate(${progress * 180}deg)`,
                color: thresholdReached
                  ? "hsl(var(--primary))"
                  : undefined,
                transition: "color 200ms",
              }}
            />
          )}
        </div>
      )}

      <div
        style={{
          transform: `translateY(${refreshing ? THRESHOLD : pull}px)`,
          transition:
            startYRef.current === null && !refreshing
              ? "transform 0.3s ease-out"
              : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
