"use client";

// MSIH CRM V1.0 — Module C: Product Catalogue
// 11 priority categories, product cards, search/filter, "Create Enquiry"
// Developer: Manoj Dore

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fmtINR } from "@/lib/api-client";
import { useUI } from "@/lib/store";
import { PageHeader, EmptyState, Loading, Skeleton } from "../shared";
import { PullToRefresh } from "../pull-to-refresh";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Package, Search, Microscope, Hammer, Scissors, Sparkles, Flame, Wrench,
  FileCheck, Download, Plus, ArrowRight, CheckCircle2, Building2, Layers,
} from "lucide-react";

const CAT_ICONS: Record<string, any> = {
  "ZEISS Microscopes": Microscope,
  "Micro Vickers Hardness Testers": Hammer,
  "Rockwell Hardness Testers": Hammer,
  "Brinell Hardness Testers": Hammer,
  "Vickers Hardness Testers": Hammer,
  "Abrasive Cutting Machines": Scissors,
  "Metallographic Polishing Machines": Sparkles,
  "Hot Mounting Presses": Layers,
  "Muffle Furnaces": Flame,
  "Industrial Furnaces": Flame,
  "Calibration Services": FileCheck,
};

export function ProductsView() {
  const { setView, productId, openProduct } = useUI();
  const qc = useQueryClient();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["products", category, search],
    queryFn: () => {
      const p = new URLSearchParams({ category, search });
      return api<any>(`/api/products?${p}`);
    },
  });

  const products = data?.products || [];
  const categories = data?.categories || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Product Catalogue"
        description="Browse MetTechnik's industrial instruments across 11 categories."
        icon={Package}
      />

      {/* filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Badge variant="secondary" className="w-fit">{products.length} products</Badge>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden p-0">
              <Skeleton className="h-32 w-full opacity-70" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full opacity-80" />
                <Skeleton className="h-3 w-2/3 opacity-70" />
                <div className="flex gap-1.5 pt-1">
                  <Skeleton className="h-4 w-16 rounded-full opacity-60" />
                  <Skeleton className="h-4 w-12 rounded-full opacity-50" />
                </div>
                <div className="flex items-center justify-between pt-3">
                  <Skeleton className="h-5 w-20 opacity-70" />
                  <Skeleton className="h-7 w-16 rounded-md opacity-80" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState icon={Package} title="No products found" description="Try a different category or search term." />
      ) : (
        <PullToRefresh
          onRefresh={async () => {
            await qc.refetchQueries({ queryKey: ["products"] });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p: any) => {
              const CIcon = CAT_ICONS[p.category] || Package;
              const specs = p.specifications ? (typeof p.specifications === "string" ? JSON.parse(p.specifications) : p.specifications) : {};
              const apps = p.applications ? (typeof p.applications === "string" ? JSON.parse(p.applications) : p.applications) : [];
              const inds = p.industries ? (typeof p.industries === "string" ? JSON.parse(p.industries) : p.industries) : [];
              return (
                <Card key={p.id} className="group flex flex-col overflow-hidden p-0 transition hover:shadow-lg">
                  {/* header banner */}
                  <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                    <div className="absolute left-3 top-3">
                      <Badge className="bg-primary/90 text-primary-foreground">{p.category}</Badge>
                    </div>
                    <CIcon className="h-14 w-14 text-primary/70 transition group-hover:scale-110" />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>

                    {Object.keys(specs).length > 0 && (
                      <div className="mt-3 space-y-1">
                        {Object.entries(specs).slice(0, 3).map(([k, v]: any) => (
                          <div key={k} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{k}</span>
                            <span className="font-medium text-foreground">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {apps.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {apps.slice(0, 3).map((a: string) => (
                          <Badge key={a} variant="outline" className="text-[10px] font-normal">{a}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-4">
                      <div>
                        {p.basePrice && <p className="text-lg font-bold text-foreground">{fmtINR(p.basePrice)}</p>}
                        <p className="text-[10px] text-muted-foreground">per {p.unit || "unit"}</p>
                      </div>
                      <Button size="sm" onClick={() => openProduct(p.id)}>
                        Details <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </PullToRefresh>
      )}

      <ProductDetail productId={productId} onClose={() => openProduct(null)} onCreateEnquiry={() => { openProduct(null); setView("enquiries"); }} />
    </div>
  );
}

function ProductDetail({ productId, onClose, onCreateEnquiry }: { productId: string | null; onClose: () => void; onCreateEnquiry: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => api<any>(`/api/products/${productId}`),
    enabled: !!productId,
  });
  const p = data?.product;
  if (!productId) return null;
  const specs = p?.specifications ? (typeof p.specifications === "string" ? JSON.parse(p.specifications) : p.specifications) : {};
  const apps = p?.applications ? (typeof p.applications === "string" ? JSON.parse(p.applications) : p.applications) : [];
  const inds = p?.industries ? (typeof p.industries === "string" ? JSON.parse(p.industries) : p.industries) : [];
  const CIcon = p ? (CAT_ICONS[p.category] || Package) : Package;

  return (
    <Sheet open={!!productId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CIcon className="h-5 w-5 text-primary" /> {p?.name}
          </SheetTitle>
          <SheetDescription>{p?.category}</SheetDescription>
        </SheetHeader>
        {isLoading || !p ? (
          <Loading label="Loading product…" />
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
              <CIcon className="h-20 w-20 text-primary/70" />
            </div>

            {p.basePrice && (
              <div className="flex items-center justify-between rounded-xl bg-primary/5 p-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Base Price</p>
                  <p className="text-2xl font-bold text-primary">{fmtINR(p.basePrice)}</p>
                </div>
                <Button onClick={onCreateEnquiry}><Plus className="mr-2 h-4 w-4" /> Create Enquiry</Button>
              </div>
            )}

            <Card className="p-4">
              <p className="text-sm text-foreground">{p.description}</p>
            </Card>

            {Object.keys(specs).length > 0 && (
              <Card className="p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground"><Wrench className="h-3.5 w-3.5" />Technical Specifications</p>
                <div className="space-y-1.5">
                  {Object.entries(specs).map(([k, v]: any) => (
                    <div key={k} className="flex justify-between border-b border-border pb-1.5 text-sm last:border-0">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-medium text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {apps.length > 0 && (
              <Card className="p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Applications</p>
                <div className="flex flex-wrap gap-2">
                  {apps.map((a: string) => <Badge key={a} variant="secondary">{a}</Badge>)}
                </div>
              </Card>
            )}

            {inds.length > 0 && (
              <Card className="p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground"><Building2 className="h-3.5 w-3.5" />Industries Served</p>
                <div className="flex flex-wrap gap-2">
                  {inds.map((i: string) => <Badge key={i} variant="outline">{i}</Badge>)}
                </div>
              </Card>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => toast.info("Brochure download will be available in a future update.")}>
                <Download className="mr-2 h-4 w-4" /> Download Catalogue
              </Button>
              <Button className="flex-1" onClick={onCreateEnquiry}>
                <Plus className="mr-2 h-4 w-4" /> Create Enquiry
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
