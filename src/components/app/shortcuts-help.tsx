"use client";

// MSIH CRM V1.0 — Keyboard Shortcuts Help Dialog (Task 9-b)
// Controlled Dialog rendered by app-shell when the user presses `?`.
// Developer: Manoj Dore

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  disabled?: boolean;
}

interface ShortcutGroup {
  title: string;
  items: Shortcut[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["⌘", "K"], description: "Open command palette" },
      { keys: ["G", "D"], description: "Go to Dashboard" },
      { keys: ["G", "E"], description: "Go to Enquiries" },
      { keys: ["G", "C"], description: "Go to Customers" },
      { keys: ["G", "Q"], description: "Go to Quotations" },
      { keys: ["G", "T"], description: "Go to Tasks" },
      { keys: ["G", "F"], description: "Go to Follow-Ups" },
      { keys: ["G", "R"], description: "Go to Reports" },
      { keys: ["G", "A"], description: "Go to AI Assistant" },
    ],
  },
  {
    title: "Actions",
    items: [
      { keys: ["N"], description: "New enquiry" },
      { keys: ["/"], description: "Focus search", disabled: true },
    ],
  },
  {
    title: "Help",
    items: [
      { keys: ["?"], description: "Show this help" },
      { keys: ["Esc"], description: "Close dialog / sheet" },
    ],
  },
];

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1.5",
        "font-mono text-[11px] font-semibold text-foreground shadow-[0_1px_0_0_rgb(0_0_0_/_0.06)]"
      )}
    >
      {children}
    </kbd>
  );
}

export function ShortcutsHelp({ open, onOpenChange }: ShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
              <Keyboard className="h-4 w-4" />
            </span>
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate faster. Keys are case-insensitive except where
            Shift is required (e.g. <kbd className="rounded border bg-muted px-1 text-[10px]">?</kbd>).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {GROUPS.map((group) => (
            <section key={group.title} className="space-y-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item, idx) => (
                  <li
                    key={`${group.title}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50"
                  >
                    <span
                      className={cn(
                        "text-sm",
                        item.disabled ? "text-muted-foreground/70" : "text-foreground"
                      )}
                    >
                      {item.description}
                      {item.disabled && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-dashed border-border bg-muted/60 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                          soon
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <Kbd key={i}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span>
            Press{" "}
            <kbd className="rounded border bg-muted px-1 font-mono text-[10px] font-semibold text-foreground">
              ?
            </kbd>{" "}
            anytime to open this dialog
          </span>
          <span className="font-medium text-foreground/70">MSIH CRM V1.0</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
