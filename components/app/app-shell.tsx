"use client";

// MSIH CRM V1.0 — Application Shell
// Layout: sidebar + header + main content (view router) + sticky footer
// Developer: Manoj Dore

import { useEffect, useRef, useState } from "react";
import { useUI } from "@/lib/store";
import type { ViewKey } from "@/lib/store";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { CommandPalette } from "./command-palette";
import { ShortcutsHelp } from "./shortcuts-help";
import { OnboardingTour } from "./onboarding-tour";
import { DashboardView } from "./views/dashboard-view";
import { CommandCenterView } from "./views/command-center-view";
import { EnquiriesView } from "./views/enquiries-view";
import { FollowupsView } from "./views/followups-view";
import { ProductsView } from "./views/products-view";
import { PerformanceView } from "./views/performance-view";
import { AiAssistantView } from "./views/ai-assistant-view";
import { ForecastingView } from "./views/forecasting-view";
import { ReportsView } from "./views/reports-view";
import { ImportExportView } from "./views/import-export-view";
import { AdminUsersView } from "./views/admin-users-view";
import { AdminProductsView } from "./views/admin-products-view";
import { AdminAuditView } from "./views/admin-audit-view";
import { AdminDeletionsView } from "./views/admin-deletions-view";
import { AdminSettingsView } from "./views/admin-settings-view";
import { AdminTransfersView } from "./views/admin-transfers-view";
import { ProfileView } from "./views/profile-view";
import { QuotationsView } from "./views/quotations-view";
import { TasksView } from "./views/tasks-view";
import { CustomersView } from "./views/customers-view";
import { CalendarView } from "./views/calendar-view";
import { EmailTemplatesView } from "./views/email-templates-view";
import { RemindersView } from "./views/reminders-view";
import { ScrollToTopButton } from "./shared";

function ViewRouter() {
  const { view } = useUI();
  return (
    <div key={view} className="animate-in fade-in-50 slide-in-from-bottom-1 duration-300">
      {(() => {
        switch (view) {
          case "dashboard": return <DashboardView />;
          case "command-center": return <CommandCenterView />;
          case "enquiries": return <EnquiriesView />;
          case "followups": return <FollowupsView />;
          case "products": return <ProductsView />;
          case "quotations": return <QuotationsView />;
          case "tasks": return <TasksView />;
          case "customers": return <CustomersView />;
          case "calendar": return <CalendarView />;
          case "email-templates": return <EmailTemplatesView />;
          case "reminders": return <RemindersView />;
          case "performance": return <PerformanceView />;
          case "ai-assistant": return <AiAssistantView />;
          case "forecasting": return <ForecastingView />;
          case "reports": return <ReportsView />;
          case "import-export": return <ImportExportView />;
          case "admin-users": return <AdminUsersView />;
          case "admin-products": return <AdminProductsView />;
          case "admin-audit": return <AdminAuditView />;
          case "admin-deletions": return <AdminDeletionsView />;
          case "admin-settings": return <AdminSettingsView />;
          case "admin-transfers": return <AdminTransfersView />;
          case "profile": return <ProfileView />;
          default: return <DashboardView />;
        }
      })()}
    </div>
  );
}


function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-gradient-to-r from-background via-muted/30 to-background px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
        <p className="flex items-center gap-2">
          <span className="inline-flex h-5 items-center rounded-md bg-primary/10 px-1.5 font-semibold text-primary ring-1 ring-primary/20">MSIH</span>
          <span className="font-semibold text-foreground">CRM V1.0</span>
          <span className="hidden text-muted-foreground/50 sm:inline">·</span>
          <span className="hidden sm:inline">MetTechnik Sales Intelligence Hub</span>
        </p>
        <p className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Free &amp; Open Source · MIT License
        </p>
        <p className="flex items-center gap-1.5">
          <span>© {new Date().getFullYear()} MetTechnik Pvt. Ltd.</span>
          <span className="text-muted-foreground/50">·</span>
          <span>Developed by <span className="font-medium text-foreground">Manoj Dore</span></span>
        </p>
      </div>
    </footer>
  );
}

// Map of "G then X" navigation shortcuts to their target views.
// Press `g` to arm the sequence (1-second window), then the next keypress
// determines the destination.
const GOTO_MAP: Record<string, ViewKey> = {
  d: "dashboard",
  e: "enquiries",
  c: "customers",
  q: "quotations",
  t: "tasks",
  f: "followups",
  r: "reports",
  a: "ai-assistant",
};

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    t.isContentEditable
  );
}

export function AppShell() {
  const { setView, openEnquiryForm } = useUI();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Refs that need to be read inside the keydown handler without forcing
  // the listener to re-bind on every state change.
  const shortcutsOpenRef = useRef(shortcutsOpen);
  useEffect(() => {
    shortcutsOpenRef.current = shortcutsOpen;
  }, [shortcutsOpen]);

  // "g armed" state — when the user presses `g`, we set a flag for 1 second.
  // If the next key matches a goto target, we navigate. Refs are used so the
  // handler always sees the latest value without re-binding.
  const gArmedRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept shortcuts when the user is typing somewhere
      if (isTypingTarget(e.target)) return;

      // Cmd/Ctrl+K is handled by the CommandPalette component — leave it alone.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") return;

      const key = e.key;

      // `?` (Shift+/) opens the shortcuts dialog
      if (key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // Escape closes the shortcuts dialog if it's open
      if (key === "Escape") {
        if (shortcutsOpenRef.current) {
          setShortcutsOpen(false);
        }
        return;
      }

      const lower = key.toLowerCase();

      // `N` opens the new enquiry form. Case-insensitive, no Ctrl/Meta/Alt
      // modifiers, and not part of a `g`-armed sequence (so `g then n` does
      // the same thing it always did: disarms and does nothing). Navigates
      // to the Enquiries view first so the form (which lives inside
      // `EnquiriesView`) is mounted, then opens the dialog via the global
      // Zustand `enquiryFormOpen` flag.
      if (
        lower === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !gArmedRef.current
      ) {
        e.preventDefault();
        setView("enquiries");
        openEnquiryForm();
        return;
      }

      // `g` arms the goto-sequence (1-second window)
      if (lower === "g" && !gArmedRef.current) {
        gArmedRef.current = true;
        if (gTimerRef.current) clearTimeout(gTimerRef.current);
        gTimerRef.current = setTimeout(() => {
          gArmedRef.current = false;
        }, 1000);
        return;
      }

      // If armed and the next key matches a goto target, navigate
      if (gArmedRef.current) {
        const target = GOTO_MAP[lower];
        if (target) {
          e.preventDefault();
          setView(target);
        }
        gArmedRef.current = false;
        if (gTimerRef.current) {
          clearTimeout(gTimerRef.current);
          gTimerRef.current = null;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [setView, openEnquiryForm]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Skip to content link for keyboard / screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onOpenShortcuts={() => setShortcutsOpen(true)} />
          <main id="main-content" className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 scroll-smooth">
            <div className="mx-auto w-full max-w-7xl">
              <ViewRouter />
            </div>
          </main>
          <Footer />
        </div>
      </div>
      <CommandPalette />
      <ScrollToTopButton />
      <ShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <OnboardingTour />
    </div>
  );
}
