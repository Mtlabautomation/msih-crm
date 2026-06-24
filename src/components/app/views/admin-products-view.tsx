"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { PageHeader, Loading, EmptyState } from "../shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Boxes, Plus, Package, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fmtINR } from "@/lib/api-client";

const CATS = ["ZEISS Microscopes","Micro Vickers Hardness Testers","Rockwell Hardness Testers","Brinell Hardness Testers","Vickers Hardness Testers","Abrasive Cutting Machines","Metallographic Polishing Machines","Hot Mounting Presses","Muffle Furnaces","Industrial Furnaces","Calibration Services"];

export function AdminProductsView() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["products-admin"], queryFn: () => api<any>("/api/products") });
  const products = data?.products || [];

  const delMut = useMutation({
    mutationFn: (id: string) => api<any>(`/api/products/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Product deleted"); qc.invalidateQueries({ queryKey: ["products-admin"] }); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Product Management" description="Add, edit, and manage the product catalogue." icon={Boxes}
        actions={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Product</Button>} />
      {isLoading ? <Loading /> : products.length === 0 ? <EmptyState icon={Package} title="No products" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p: any) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{p.name}</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">{p.category}</Badge>
                </div>
                {p.basePrice && <p className="text-sm font-bold text-primary">{fmtINR(p.basePrice)}</p>}
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info("Edit form coming soon")}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (confirm("Delete this product?")) delMut.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <CreateProductDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function CreateProductDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", category: CATS[0], description: "", basePrice: "", unit: "Unit", applications: "", industries: "" });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const m = useMutation({
    mutationFn: () => api<any>("/api/products", { method: "POST", body: JSON.stringify({
      ...form, basePrice: form.basePrice || null,
      applications: form.applications ? form.applications.split(",").map((s) => s.trim()) : null,
      industries: form.industries ? form.industries.split(",").map((s) => s.trim()) : null,
    }) }),
    onSuccess: () => { toast.success("Product created"); qc.invalidateQueries({ queryKey: ["products-admin"] }); qc.invalidateQueries({ queryKey: ["products"] }); onOpenChange(false); setForm({ name: "", category: CATS[0], description: "", basePrice: "", unit: "Unit", applications: "", industries: "" }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Add Product</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Category</Label><Select value={form.category} onValueChange={(v) => set("category", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Base Price (₹)</Label><Input type="number" value={form.basePrice} onChange={(e) => set("basePrice", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Unit</Label><Input value={form.unit} onChange={(e) => set("unit", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Applications (comma-separated)</Label><Input value={form.applications} onChange={(e) => set("applications", e.target.value)} placeholder="Quality Control, Metallurgy" /></div>
          <div className="space-y-1.5"><Label>Industries (comma-separated)</Label><Input value={form.industries} onChange={(e) => set("industries", e.target.value)} placeholder="Automotive, Aerospace" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => m.mutate()} disabled={m.isPending || !form.name}>Create Product</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
