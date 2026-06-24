"use client";

// MSIH CRM V1.0 — Global command palette (Cmd/Ctrl+K)
// Developer: Manoj Dore

import { useEffect } from "react";
import { useUI } from "@/lib/store";
import { VIEW_LABELS } from "./nav-config";
import { useSession } from "next-auth/react";
import { navForRole } from "./nav-config";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator,
} from "@/components/ui/command";
import { LayoutDashboard, Inbox, PhoneCall, Plus, Search, FileSignature, ListChecks, Building2, CalendarDays, Mail, BellRing } from "lucide-react";

export function CommandPalette() {
  const { commandOpen, setCommandOpen, setView } = useUI();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "EXECUTIVE";
  const items = navForRole(role);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCommandOpen]);

  const go = (key: any) => {
    setView(key);
    setCommandOpen(false);
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search modules, enquiries, quick actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => go("enquiries")}>
            <Plus className="mr-2 h-4 w-4" /> New Enquiry
          </CommandItem>
          <CommandItem onSelect={() => go("quotations")}>
            <FileSignature className="mr-2 h-4 w-4" /> New Quotation
          </CommandItem>
          <CommandItem onSelect={() => go("tasks")}>
            <ListChecks className="mr-2 h-4 w-4" /> New Task
          </CommandItem>
          <CommandItem onSelect={() => go("customers")}>
            <Building2 className="mr-2 h-4 w-4" /> New Customer
          </CommandItem>
          <CommandItem onSelect={() => go("followups")}>
            <PhoneCall className="mr-2 h-4 w-4" /> Log Follow-Up
          </CommandItem>
          <CommandItem onSelect={() => go("calendar")}>
            <CalendarDays className="mr-2 h-4 w-4" /> Open Calendar
          </CommandItem>
          <CommandItem onSelect={() => go("reminders")}>
            <BellRing className="mr-2 h-4 w-4" /> Schedule Reminder
          </CommandItem>
          <CommandItem onSelect={() => go("email-templates")}>
            <Mail className="mr-2 h-4 w-4" /> Email Templates
          </CommandItem>
          <CommandItem onSelect={() => go("dashboard")}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Open Dashboard
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Modules">
          {items.map((item) => (
            <CommandItem key={item.key} onSelect={() => go(item.key)}>
              <item.icon className="mr-2 h-4 w-4" />
              {VIEW_LABELS[item.key] || item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
