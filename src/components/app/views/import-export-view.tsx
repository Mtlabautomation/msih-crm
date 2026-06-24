"use client";

// MSIH CRM V1.0 — Import / Export View (Task 7-a)
// Module I: CSV Import Wizard (3-step) + Export panel
// Developer: Manoj Dore — MIT License

import { useCallback, useMemo, useRef, useState } from "react";
import { PageHeader, SectionCard } from "../shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowUpDown,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  FileImage,
  Database,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  X,
  FileUp,
  Building2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

// ---------- Field catalogue per entity ----------
type EntityKey = "enquiry" | "customer";

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
}

const ENQUIRY_FIELDS: FieldDef[] = [
  { key: "company", label: "Company", required: true },
  { key: "contactPerson", label: "Contact Person", required: true },
  { key: "mobile", label: "Mobile", required: true },
  { key: "productInterested", label: "Product Interested", required: true },
  { key: "email", label: "Email" },
  { key: "budget", label: "Budget (₹)" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "status", label: "Status" },
  { key: "leadScore", label: "Lead Score (0-100)" },
  { key: "source", label: "Source" },
  { key: "remarks", label: "Remarks" },
  { key: "specification", label: "Specification" },
  { key: "date", label: "Date" },
];

const CUSTOMER_FIELDS: FieldDef[] = [
  { key: "company", label: "Company", required: true },
  { key: "contactPerson", label: "Contact Person", required: true },
  { key: "mobile", label: "Mobile", required: true },
  { key: "email", label: "Email" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "address", label: "Address" },
  { key: "industry", label: "Industry" },
  { key: "gstin", label: "GSTIN" },
  { key: "website", label: "Website" },
];

// ---------- CSV parser (handles quoted fields, escaped quotes, CRLF/LF) ----------
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Normalise line endings
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let i = 0;
  let inQuotes = false;

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    // Not in quotes
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      records.push(row);
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Last field
  if (field !== "" || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  // Drop empty trailing rows
  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}

// ---------- Header auto-matching ----------
const HEADER_ALIASES: Record<string, string> = {
  // company
  company: "company",
  "company name": "company",
  "firm name": "company",
  organisation: "company",
  organization: "company",
  "client name": "company",
  // contactPerson
  "contact person": "contactPerson",
  contact: "contactPerson",
  "contact name": "contactPerson",
  name: "contactPerson",
  "person name": "contactPerson",
  // mobile
  mobile: "mobile",
  "mobile number": "mobile",
  phone: "mobile",
  "phone number": "mobile",
  "contact number": "mobile",
  "mobile no": "mobile",
  // email
  email: "email",
  "email id": "email",
  "email address": "email",
  "e-mail": "email",
  // productInterested
  product: "productInterested",
  "product interested": "productInterested",
  "product name": "productInterested",
  "interested product": "productInterested",
  // budget
  budget: "budget",
  "budget amount": "budget",
  value: "budget",
  // city / state / address
  city: "city",
  state: "state",
  "city/state": "city",
  address: "address",
  // status / leadScore / source
  status: "status",
  "lead score": "leadScore",
  score: "leadScore",
  source: "source",
  "lead source": "source",
  // remarks / specification
  remarks: "remarks",
  notes: "remarks",
  comment: "remarks",
  specification: "specification",
  specs: "specification",
  // date
  date: "date",
  "enquiry date": "date",
  // industry / gstin / website
  industry: "industry",
  gstin: "gstin",
  "gst number": "gstin",
  website: "website",
  url: "website",
};

function autoMatchHeader(
  header: string,
  fields: FieldDef[],
  usedFields: Set<string>
): string {
  const h = header.toLowerCase().trim();
  // 1. Exact field key match
  if (fields.some((f) => f.key === h) && !usedFields.has(h)) return h;
  // 2. Alias match
  const alias = HEADER_ALIASES[h];
  if (alias && fields.some((f) => f.key === alias) && !usedFields.has(alias)) {
    return alias;
  }
  // 3. Partial contains match (e.g., "Customer Company" → company)
  for (const f of fields) {
    if (usedFields.has(f.key)) continue;
    if (h.includes(f.key.toLowerCase())) return f.key;
  }
  // 4. No match
  return "__none__";
}

// ---------- Wizard Step Indicator ----------
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Upload" },
    { n: 2, label: "Map" },
    { n: 3, label: "Review" },
  ];
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {steps.map((s, idx) => {
        const isActive = s.n === current;
        const isDone = s.n < current;
        return (
          <div key={s.n} className="flex items-center gap-1 sm:gap-2">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors sm:px-3 sm:text-sm",
                isActive && "bg-primary text-primary-foreground shadow-sm",
                isDone && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                !isActive && !isDone && "bg-muted text-muted-foreground"
              )}
              aria-current={isActive ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                  isActive && "bg-primary-foreground/25",
                  isDone && "bg-emerald-500/25",
                  !isActive && !isDone && "bg-background/60"
                )}
              >
                {isDone ? <CheckCircle2 className="h-3 w-3" /> : s.n}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <ArrowRight
                className={cn(
                  "h-3 w-3 sm:h-4 sm:w-4",
                  s.n < current ? "text-emerald-500" : "text-muted-foreground/50"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Entity Selector ----------
function EntitySelector({
  value,
  onChange,
}: {
  value: EntityKey;
  onChange: (v: EntityKey) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-1">
      <button
        type="button"
        onClick={() => onChange("enquiry")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          value === "enquiry"
            ? "bg-background text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={value === "enquiry"}
      >
        <Building2 className="h-4 w-4" />
        Enquiries
      </button>
      <button
        type="button"
        onClick={() => onChange("customer")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          value === "customer"
            ? "bg-background text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={value === "customer"}
      >
        <Users className="h-4 w-4" />
        Customers
      </button>
    </div>
  );
}

// ---------- Import Wizard Component ----------
function ImportWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [entity, setEntity] = useState<EntityKey>("enquiry");
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    failed: number;
    total: number;
    errors: { row: number; error: string }[];
  } | null>(null);

  const fields = entity === "enquiry" ? ENQUIRY_FIELDS : CUSTOMER_FIELDS;
  const requiredFields = fields.filter((f) => f.required).map((f) => f.key);

  // Reset wizard state
  const resetWizard = useCallback(() => {
    setStep(1);
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setParsing(false);
    setDragOver(false);
    setImporting(false);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Handle file selection / drop
  const handleFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Please upload a .csv file");
        return;
      }
      setParsing(true);
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || "");
          const { headers: parsedHeaders, rows: parsedRows } = parseCSV(text);
          if (parsedHeaders.length === 0) {
            toast.error("CSV is empty or could not be parsed");
            setParsing(false);
            return;
          }
          if (parsedRows.length === 0) {
            toast.error("CSV must contain a header row and at least 1 data row");
            setParsing(false);
            return;
          }
          // Auto-match headers
          const usedFields = new Set<string>();
          const autoMapping: Record<string, string> = {};
          for (const h of parsedHeaders) {
            const matched = autoMatchHeader(h, fields, usedFields);
            if (matched !== "__none__") {
              autoMapping[h] = matched;
              usedFields.add(matched);
            }
          }
          setHeaders(parsedHeaders);
          setRows(parsedRows);
          setMapping(autoMapping);
          setParsing(false);
          toast.success(
            `Parsed ${parsedRows.length} rows • ${Object.keys(autoMapping).length} columns auto-mapped`
          );
        } catch (e: any) {
          toast.error("Failed to parse CSV: " + String(e?.message || e).slice(0, 80));
          setParsing(false);
        }
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
        setParsing(false);
      };
      reader.readAsText(file);
    },
    [entity, fields]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      handleFile(file);
    },
    [handleFile]
  );

  // When entity changes mid-wizard, re-auto-match
  const handleEntityChange = useCallback(
    (v: EntityKey) => {
      setEntity(v);
      if (headers.length > 0) {
        const newFields = v === "enquiry" ? ENQUIRY_FIELDS : CUSTOMER_FIELDS;
        const usedFields = new Set<string>();
        const autoMapping: Record<string, string> = {};
        for (const h of headers) {
          const matched = autoMatchHeader(h, newFields, usedFields);
          if (matched !== "__none__") {
            autoMapping[h] = matched;
            usedFields.add(matched);
          }
        }
        setMapping(autoMapping);
      }
    },
    [headers]
  );

  // ---------- Step 2: Mapping helpers ----------
  const mappedFields = useMemo(() => {
    return new Set(Object.values(mapping).filter((v) => v !== "__none__"));
  }, [mapping]);

  const missingRequired = useMemo(
    () => requiredFields.filter((f) => !mappedFields.has(f)),
    [mapping, requiredFields]
  );

  const setMappingFor = (csvHeader: string, schemaField: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (schemaField === "__none__") {
        delete next[csvHeader];
      } else {
        // Remove this schemaField from any other csv header that had it
        for (const [k, v] of Object.entries(next)) {
          if (v === schemaField && k !== csvHeader) delete next[k];
        }
        next[csvHeader] = schemaField;
      }
      return next;
    });
  };

  // ---------- Step 3: Final preview data (mapped columns only) ----------
  const mappedCsvHeaders = useMemo(() => {
    return Object.entries(mapping)
      .filter(([, f]) => f !== "__none__")
      .map(([h]) => h);
  }, [mapping]);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const optionalMappedCount = useMemo(() => {
    let count = 0;
    for (const v of Object.values(mapping)) {
      if (v !== "__none__" && !requiredFields.includes(v)) count++;
    }
    return count;
  }, [mapping, requiredFields]);

  // ---------- Submit ----------
  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await api<{
        inserted: number;
        failed: number;
        total: number;
        errors: { row: number; error: string }[];
      }>("/api/import-entities", {
        method: "POST",
        body: JSON.stringify({ entity, rows, mapping }),
      });
      setImportResult(result);
      if (result.inserted > 0) {
        toast.success(`Imported ${result.inserted} of ${result.total} rows`);
        // Invalidate relevant query cache
        if (entity === "enquiry") {
          qc.invalidateQueries({ queryKey: ["enquiries"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
        } else {
          qc.invalidateQueries({ queryKey: ["customers"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
        }
      } else {
        toast.error(`Imported 0 of ${result.total} rows — check errors below`);
      }
      if (result.failed > 0 && result.inserted === 0) {
        // All failed — stay on review step so user sees errors
      } else {
        // Close wizard after a short delay so user sees the success state
        setTimeout(() => {
          onOpenChange(false);
          resetWizard();
        }, 1200);
      }
    } catch (e: any) {
      toast.error("Import failed: " + String(e?.message || e).slice(0, 120));
    } finally {
      setImporting(false);
    }
  };

  const closeDialog = (v: boolean) => {
    if (!v && importing) return; // block close during import
    onOpenChange(v);
    if (!v) {
      // delay reset so closing animation doesn't jump
      setTimeout(resetWizard, 200);
    }
  };

  // ---------- Render ----------
  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileUp className="h-5 w-5 text-primary" />
            CSV Import Wizard
          </DialogTitle>
          <DialogDescription>
            Upload, map columns, review — then bulk insert into the database.
          </DialogDescription>
        </DialogHeader>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Entity selector + step indicator */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-72">
              <EntitySelector value={entity} onChange={handleEntityChange} />
            </div>
            <StepIndicator current={step} />
          </div>

          {/* STEP 1: Upload & Parse */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload CSV file"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                  dragOver
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-primary/5"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                {parsing ? (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-medium text-foreground">Parsing…</p>
                  </>
                ) : fileName ? (
                  <>
                    <FileSpreadsheet className="h-10 w-10 text-emerald-500" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {rows.length} rows • {headers.length} columns
                      </p>
                    </div>
                    <p className="text-xs text-primary underline">Click to choose another file</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Drag & drop or click to upload
                      </p>
                      <p className="text-xs text-muted-foreground">.csv files only</p>
                    </div>
                  </>
                )}
              </div>

              {/* Preview of first 5 rows */}
              {rows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Preview (first 5 of {rows.length} rows)
                  </p>
                  <div className="max-h-64 overflow-auto rounded-md border border-border/60">
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur">
                        <TableRow>
                          {headers.map((h) => (
                            <TableHead key={h} className="text-xs">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((r, idx) => (
                          <TableRow key={idx}>
                            {headers.map((h) => (
                              <TableCell key={h} className="text-xs">
                                {r[h] || "—"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Tip:</span> First row must contain
                column headers. Headers will be auto-matched to {entity === "enquiry" ? "enquiry" : "customer"} fields on the next step.
              </p>
            </div>
          )}

          {/* STEP 2: Map Columns */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {headers.map((h) => {
                  const mapped = mapping[h];
                  const isRequired = mapped
                    ? requiredFields.includes(mapped)
                    : false;
                  return (
                    <div
                      key={h}
                      className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-muted-foreground" title={h}>
                          CSV column:
                        </p>
                        <p className="truncate text-sm font-medium text-foreground" title={h}>
                          {h}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      <div className="w-40 shrink-0">
                        <Select
                          value={mapped || "__none__"}
                          onValueChange={(v) => setMappingFor(h, v)}
                        >
                          <SelectTrigger className="h-8 w-full text-xs" size="sm">
                            <SelectValue placeholder="Skip" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Skip —</SelectItem>
                            {fields.map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}
                                {f.required ? " *" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {isRequired && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" title="Required" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Missing-required warning */}
              {missingRequired.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Required fields not yet mapped:</p>
                    <p className="text-xs">{missingRequired.join(", ")}</p>
                  </div>
                </div>
              )}

              {/* 3-row preview of mapped values */}
              {mappedCsvHeaders.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Mapped preview (first 3 rows)
                  </p>
                  <div className="max-h-56 overflow-auto rounded-md border border-border/60">
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur">
                        <TableRow>
                          {mappedCsvHeaders.map((h) => (
                            <TableHead key={h} className="text-xs">
                              {mapping[h]}
                              {requiredFields.includes(mapping[h]) && (
                                <span className="ml-0.5 text-primary">*</span>
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.slice(0, 3).map((r, idx) => (
                          <TableRow key={idx}>
                            {mappedCsvHeaders.map((h) => (
                              <TableCell key={h} className="text-xs">
                                {r[h] || "—"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Review & Confirm */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-md border border-border/60 bg-card p-3">
                  <p className="text-xs text-muted-foreground">Total rows</p>
                  <p className="text-lg font-bold text-foreground">{rows.length}</p>
                </div>
                <div className="rounded-md border border-border/60 bg-card p-3">
                  <p className="text-xs text-muted-foreground">Required mapped</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {requiredFields.length - missingRequired.length}/{requiredFields.length}
                  </p>
                </div>
                <div className="rounded-md border border-border/60 bg-card p-3">
                  <p className="text-xs text-muted-foreground">Optional mapped</p>
                  <p className="text-lg font-bold text-primary">{optionalMappedCount}</p>
                </div>
                <div className="rounded-md border border-border/60 bg-card p-3">
                  <p className="text-xs text-muted-foreground">Entity</p>
                  <p className="text-lg font-bold text-foreground capitalize">{entity}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Ready to import <span className="font-semibold text-foreground">{rows.length} rows</span> as{" "}
                <span className="font-semibold text-foreground capitalize">{entity}s</span>.{" "}
                {requiredFields.length - missingRequired.length} of {requiredFields.length} required fields mapped,{" "}
                {optionalMappedCount} optional field{optionalMappedCount === 1 ? "" : "s"} mapped.
              </p>

              {/* Final preview table */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Final preview (first 5 rows, mapped columns only)
                </p>
                <div className="max-h-64 overflow-auto rounded-md border border-border/60">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur">
                      <TableRow>
                        {mappedCsvHeaders.map((h) => (
                          <TableHead key={h} className="text-xs">
                            {mapping[h]}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((r, idx) => (
                        <TableRow key={idx}>
                          {mappedCsvHeaders.map((h) => (
                            <TableCell key={h} className="text-xs">
                              {r[h] || "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Import result */}
              {importResult && (
                <div
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    importResult.failed > 0 && importResult.inserted === 0
                      ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
                      : importResult.failed > 0
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  )}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {importResult.failed > 0 && importResult.inserted === 0 ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Inserted {importResult.inserted} • Failed {importResult.failed} • Total{" "}
                    {importResult.total}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-1 text-xs">
                      {importResult.errors.map((er, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            row {er.row}
                          </span>
                          <span className="flex-1">{er.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — step controls */}
        <div className="flex items-center justify-between gap-2 border-t border-border/60 px-6 py-3">
          <div className="text-xs text-muted-foreground">
            {step === 1 && (rows.length > 0 ? `${rows.length} rows parsed` : "No file yet")}
            {step === 2 &&
              `${mappedFields.size}/${headers.length} columns mapped`}
            {step === 3 && "Ready to import"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => closeDialog(false)}
              disabled={importing}
            >
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                disabled={importing}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
            {step === 1 && (
              <Button
                size="sm"
                onClick={() => setStep(2)}
                disabled={rows.length === 0 || parsing}
              >
                Continue
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {step === 2 && (
              <Button
                size="sm"
                onClick={() => setStep(3)}
                disabled={missingRequired.length > 0}
              >
                Review & Import
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {step === 3 && (
              <Button
                size="sm"
                onClick={handleImport}
                disabled={importing || rows.length === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Database className="mr-1 h-4 w-4" />
                    Import {rows.length} rows
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main View ----------
export function ImportExportView() {
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);

  const exportEnquiries = (fmt: "csv" | "json") => {
    fetch("/api/enquiries?limit=1000")
      .then((r) => r.json())
      .then((d) => {
        const enquiries = d.enquiries || [];
        if (fmt === "json") {
          const blob = new Blob([JSON.stringify(enquiries, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "msih-enquiries.json";
          a.click();
          URL.revokeObjectURL(url);
        } else {
          const headers = [
            "enquiryNumber",
            "date",
            "company",
            "contactPerson",
            "mobile",
            "email",
            "productInterested",
            "budget",
            "city",
            "state",
            "status",
            "leadScore",
            "assignedExecutive",
          ];
          const rows = enquiries.map((e: any) =>
            headers
              .map((h) =>
                `"${String((h === "assignedExecutive" ? e.assignedExecutive?.name : e[h]) ?? "").replace(/"/g, '""')}"`
              )
              .join(",")
          );
          const csv = [headers.join(","), ...rows].join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "msih-enquiries.csv";
          a.click();
          URL.revokeObjectURL(url);
        }
        toast.success(`Exported ${enquiries.length} enquiries as ${fmt.toUpperCase()}`);
        // Refresh export cache
        qc.invalidateQueries({ queryKey: ["enquiries"] });
      })
      .catch(() => toast.error("Export failed"));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Import / Export"
        description="Bulk import enquiries and customers via CSV; export data in multiple formats."
        icon={ArrowUpDown}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------- IMPORT ---------- */}
        <SectionCard
          title="Import Data"
          description="Upload CSV with column-mapping preview"
          icon={Upload}
          action={
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <FileUp className="mr-1 h-4 w-4" />
              Open Wizard
            </Button>
          }
        >
          <div className="space-y-3">
            <div
              role="button"
              tabIndex={0}
              aria-label="Open CSV import wizard"
              onClick={() => setWizardOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setWizardOpen(true);
                }
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="rounded-full bg-primary/10 p-3">
                <FileSpreadsheet className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Start CSV Import Wizard
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Drag &amp; drop or click — 3-step: upload → map → review
                </p>
              </div>
              <Button size="sm" variant="default" className="mt-1">
                <Upload className="mr-1 h-4 w-4" />
                Choose CSV file
              </Button>
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Supported entities:</p>
              <ul className="mt-1 space-y-0.5">
                <li>
                  <span className="font-medium">Enquiries</span> — required: company, contactPerson,
                  mobile, productInterested
                </li>
                <li>
                  <span className="font-medium">Customers</span> — required: company, contactPerson,
                  mobile
                </li>
              </ul>
            </div>
          </div>
        </SectionCard>

        {/* ---------- EXPORT (unchanged) ---------- */}
        <SectionCard title="Export Data" description="Download enquiries in your preferred format" icon={Download}>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: FileSpreadsheet,
                label: "Excel/CSV",
                desc: "Spreadsheet",
                fmt: "csv" as const,
                color: "text-emerald-600 bg-emerald-500/10",
              },
              {
                icon: FileText,
                label: "JSON",
                desc: "Raw data",
                fmt: "json" as const,
                color: "text-sky-600 bg-sky-500/10",
              },
              {
                icon: FileText,
                label: "PDF",
                desc: "Document",
                fmt: null,
                color: "text-red-600 bg-red-500/10",
              },
              {
                icon: FileImage,
                label: "PPT",
                desc: "Presentation",
                fmt: null,
                color: "text-violet-600 bg-violet-500/10",
              },
            ].map((f) => (
              <Card
                key={f.label}
                className="cursor-pointer p-4 transition hover:shadow-md"
                onClick={() =>
                  f.fmt
                    ? exportEnquiries(f.fmt)
                    : toast.info(`${f.label} export available in next update`)
                }
              >
                <div className={`mb-2 inline-flex rounded-lg p-2 ${f.color}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <p className="font-semibold text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="About Data" description="What gets imported/exported" icon={Database}>
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Enquiries with all fields
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Customer company info
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Follow-up history
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Quotation records
          </p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Export permissions follow RBAC: Executives export own data only; Managers/Admins export
          full database. Imports create records assigned to the current user.
        </p>
      </SectionCard>

      <ImportWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
