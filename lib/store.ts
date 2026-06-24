"use client";

import { create } from "zustand";

export type ViewKey =
  | "dashboard"
  | "command-center"
  | "enquiries"
  | "followups"
  | "products"
  | "quotations"
  | "tasks"
  | "customers"
  | "calendar"
  | "email-templates"
  | "reminders"
  | "performance"
  | "ai-assistant"
  | "forecasting"
  | "reports"
  | "import-export"
  | "admin-users"
  | "admin-products"
  | "admin-audit"
  | "admin-deletions"
  | "admin-settings"
  | "admin-transfers"
  | "profile";

// localStorage key that records whether the first-time-user onboarding tour
// has been completed or dismissed. Absence of this key triggers the tour.
export const TOUR_STORAGE_KEY = "msih-onboarding-completed";

// Total number of steps in the onboarding tour (matches OnboardingTour steps).
export const TOUR_TOTAL_STEPS = 6;

interface UIState {
  view: ViewKey;
  enquiryId: string | null;       // selected enquiry for detail view
  productId: string | null;       // for product detail
  sidebarOpen: boolean;           // mobile sidebar
  commandOpen: boolean;           // global command palette
  enquiryFormOpen: boolean;       // create-enquiry dialog (global so the `N` shortcut can open it from any view)
  tourActive: boolean;            // onboarding tour overlay is shown
  tourStep: number;               // 0-indexed current tour step
  setView: (v: ViewKey) => void;
  openEnquiry: (id: string | null) => void;
  openProduct: (id: string | null) => void;
  setSidebarOpen: (o: boolean) => void;
  setCommandOpen: (o: boolean) => void;
  openEnquiryForm: () => void;
  closeEnquiryForm: () => void;
  // Onboarding tour controls
  startTour: () => void;
  dismissTour: () => void;
  completeTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
}

export const useUI = create<UIState>((set, get) => ({
  view: "dashboard",
  enquiryId: null,
  productId: null,
  sidebarOpen: false,
  commandOpen: false,
  enquiryFormOpen: false,
  tourActive: false,
  tourStep: 0,
  // Navigating to another view also closes any open create-enquiry dialog
  // (prevents the dialog from re-opening when the user returns to Enquiries later).
  setView: (v) => set({ view: v, enquiryId: null, productId: null, sidebarOpen: false, enquiryFormOpen: false }),
  openEnquiry: (id) => set({ enquiryId: id }),
  openProduct: (id) => set({ productId: id }),
  setSidebarOpen: (o) => set({ sidebarOpen: o }),
  setCommandOpen: (o) => set({ commandOpen: o }),
  openEnquiryForm: () => set({ enquiryFormOpen: true }),
  closeEnquiryForm: () => set({ enquiryFormOpen: false }),

  // ----- Onboarding tour -----
  startTour: () => {
    // Reset to step 0 and jump to the dashboard so the user has a known
    // starting point for the walkthrough.
    set({ tourActive: true, tourStep: 0, view: "dashboard", enquiryId: null, productId: null });
  },
  dismissTour: () => {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(TOUR_STORAGE_KEY, "dismissed"); } catch { /* ignore */ }
    }
    set({ tourActive: false });
  },
  completeTour: () => {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(TOUR_STORAGE_KEY, "completed"); } catch { /* ignore */ }
    }
    set({ tourActive: false });
  },
  nextTourStep: () => {
    const { tourStep } = get();
    if (tourStep >= TOUR_TOTAL_STEPS - 1) {
      // Last step → mark complete and tear down the overlay.
      get().completeTour();
    } else {
      set({ tourStep: tourStep + 1 });
    }
  },
  prevTourStep: () => {
    const { tourStep } = get();
    if (tourStep > 0) set({ tourStep: tourStep - 1 });
  },
}));
