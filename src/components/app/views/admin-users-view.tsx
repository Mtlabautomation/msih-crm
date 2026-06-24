"use client";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { PageHeader, Loading } from "../shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserRound, Mail, Phone, MapPin, ShieldCheck, Plus, UserCog } from "lucide-react";
import { useState } from "react";
import { fmtDate, roleColor } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function AdminUsersView() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["users-list"], queryFn: () => api<any>("/api/users") });
  const users = data?.users || [];

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api<any>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify({ active: !active }) }),
    onSuccess: () => { toast.success("User status updated"); qc.invalidateQueries({ queryKey: ["users-list"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="User Management" description="Create and manage user accounts & roles." icon={ShieldCheck}
        actions={role !== "EXECUTIVE" && role !== "MANAGER" ? <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add User</Button> : undefined} />
      {isLoading ? <Loading /> : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 font-semibold">User</th><th className="p-3 font-semibold">Role</th>
                  <th className="p-3 font-semibold">Contact</th><th className="p-3 font-semibold">Location</th>
                  <th className="p-3 font-semibold">Status</th><th className="p-3 font-semibold">Created</th>
                  <th className="p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <p className="font-semibold text-foreground">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="p-3"><span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", roleColor(u.role))}>{u.role.replace(/_/g, " ")}</span></td>
                    <td className="p-3 text-xs"><p>{u.phone || "—"}</p><p className="text-muted-foreground">{u.designation || ""}</p></td>
                    <td className="p-3 text-xs">{[u.city, u.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="p-3"><Badge variant={u.active ? "default" : "secondary"} className={u.active ? "bg-emerald-500/15 text-emerald-600" : ""}>{u.active ? "Active" : "Disabled"}</Badge></td>
                    <td className="p-3 text-xs text-muted-foreground">{fmtDate(u.createdAt)}</td>
                    <td className="p-3">
                      {(role === "ADMIN" || role === "SUPER_ADMIN") && u.id !== (session?.user as any)?.id && (
                        <Button size="sm" variant="ghost" onClick={() => toggleMut.mutate({ id: u.id, active: u.active })}>{u.active ? "Disable" : "Enable"}</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <CreateUserDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", password: "admin@123", role: "EXECUTIVE", phone: "", designation: "", city: "", state: "" });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const m = useMutation({
    mutationFn: () => api<any>("/api/users", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => { toast.success("User created"); qc.invalidateQueries({ queryKey: ["users-list"] }); onOpenChange(false); setForm({ name: "", email: "", password: "admin@123", role: "EXECUTIVE", phone: "", designation: "", city: "", state: "" }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-primary" /> Add New User</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Password</Label><Input value={form.password} onChange={(e) => set("password", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Role</Label><Select value={form.role} onValueChange={(v) => set("role", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EXECUTIVE">Sales Executive</SelectItem><SelectItem value="MANAGER">Sales Manager</SelectItem><SelectItem value="ADMIN">Admin</SelectItem><SelectItem value="SUPER_ADMIN">Super Admin</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Designation</Label><Input value={form.designation} onChange={(e) => set("designation", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => m.mutate()} disabled={m.isPending || !form.name || !form.email}>Create User</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
