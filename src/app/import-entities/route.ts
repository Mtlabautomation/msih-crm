// MSIH CRM V1.0 — Bulk Import API (column-mapping aware)
// Task 7-a: POST /api/import-entities
//   Body: { entity: "enquiry" | "customer", rows: Record<string,string>[],
//           mapping: Record<string,string> /* csvHeader -> schemaField */ }
//   Returns: { inserted: number, failed: number, errors: Array<{row:number,error:string}>, total: number }
// Developer: Manoj Dore — MIT License

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// Valid status / source enums (kept loose — fall back to default if invalid)
const VALID_ENQUIRY_STATUS = new Set([
  "NEW",
  "QUALIFIED",
  "HOT",
  "WARM",
  "COLD",
  "LOST",
  "CONVERTED",
]);
const VALID_ENQUIRY_SOURCE = new Set([
  "WEBSITE",
  "REFERENCE",
  "EXHIBITION",
  "COLD_CALL",
  "EMAIL_CAMPAIGN",
  "SOCIAL_MEDIA",
  "TELEMARKETING",
  "OTHER",
  "IMPORT",
]);

function random4(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function generateUniqueEnquiryNumber(): Promise<string> {
  const year = new Date().getFullYear();
  // Try a few times to avoid rare collisions
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `ENQ-${year}-${random4()}`;
    const exists = await db.enquiry.findUnique({
      where: { enquiryNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  // Extremely unlikely fallback — append millisecond timestamp
  return `ENQ-${year}-${Date.now().toString().slice(-6)}`;
}

function safeFloat(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function safeInt(v: unknown, min: number, max: number): number | null {
  if (v == null || v === "") return null;
  const n = parseInt(String(v).replace(/[^0-9.\-]/g, ""), 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function safeDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function pick(row: Record<string, string>, mapping: Record<string, string>, field: string): string {
  // Find the CSV column mapped to this schema field
  for (const [csvHeader, schemaField] of Object.entries(mapping)) {
    if (schemaField === field) {
      const val = row[csvHeader];
      if (val == null) return "";
      return String(val).trim();
    }
  }
  return "";
}

// ---------- POST ----------
export async function POST(req: NextRequest) {
  // Auth
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entity: string = body?.entity;
  const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
  const mapping: Record<string, string> =
    body?.mapping && typeof body.mapping === "object" ? body.mapping : {};

  if (entity !== "enquiry" && entity !== "customer") {
    return NextResponse.json(
      { error: "entity must be 'enquiry' or 'customer'" },
      { status: 400 }
    );
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }
  if (rows.length > 5000) {
    return NextResponse.json(
      { error: "Import limit is 5000 rows per request" },
      { status: 400 }
    );
  }

  // Validate that at least the required mapping exists
  const mappedFields = new Set(Object.values(mapping));
  const requiredEnquiry = ["company", "contactPerson", "mobile", "productInterested"];
  const requiredCustomer = ["company", "contactPerson", "mobile"];
  const required = entity === "enquiry" ? requiredEnquiry : requiredCustomer;
  const missingRequired = required.filter((f) => !mappedFields.has(f));
  if (missingRequired.length > 0) {
    return NextResponse.json(
      {
        error: `Missing required column mapping for: ${missingRequired.join(", ")}`,
      },
      { status: 400 }
    );
  }

  let inserted = 0;
  let failed = 0;
  const errors: { row: number; error: string }[] = [];

  try {
    await db.$transaction(
      async (tx) => {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i] || {};
          try {
            // Extract mapped values
            const company = pick(row, mapping, "company");
            const contactPerson = pick(row, mapping, "contactPerson");
            const mobile = pick(row, mapping, "mobile");
            const email = pick(row, mapping, "email") || null;
            const city = pick(row, mapping, "city") || null;
            const state = pick(row, mapping, "state") || null;

            // Validate required values per row
            if (entity === "enquiry") {
              const productInterested = pick(row, mapping, "productInterested");
              if (!company) {
                failed++;
                errors.push({ row: i + 1, error: "Missing required field: company" });
                continue;
              }
              if (!contactPerson) {
                failed++;
                errors.push({ row: i + 1, error: "Missing required field: contactPerson" });
                continue;
              }
              if (!mobile) {
                failed++;
                errors.push({ row: i + 1, error: "Missing required field: mobile" });
                continue;
              }
              if (!productInterested) {
                failed++;
                errors.push({ row: i + 1, error: "Missing required field: productInterested" });
                continue;
              }

              // Optional fields
              const budget = safeFloat(pick(row, mapping, "budget"));
              const leadScore = safeInt(pick(row, mapping, "leadScore"), 0, 100);
              const dateVal = safeDate(pick(row, mapping, "date"));
              const remarks = pick(row, mapping, "remarks") || null;
              const specification = pick(row, mapping, "specification") || null;

              // status & source (validate enum, fall back to default)
              let status = pick(row, mapping, "status").toUpperCase();
              if (!VALID_ENQUIRY_STATUS.has(status)) status = "NEW";

              let source = pick(row, mapping, "source").toUpperCase();
              if (!source || !VALID_ENQUIRY_SOURCE.has(source)) source = "IMPORT";

              // Find or create customer (customerId is required by schema)
              let customerId: string | undefined;
              const existingCust = await tx.customer.findFirst({
                where: {
                  OR: [
                    { mobile },
                    ...(email ? [{ email }] : []),
                  ],
                },
                select: { id: true },
              });
              if (existingCust) {
                customerId = existingCust.id;
              } else {
                const cust = await tx.customer.create({
                  data: {
                    company,
                    contactPerson,
                    mobile,
                    email,
                    city,
                    state,
                    createdBy: user.id,
                  },
                  select: { id: true },
                });
                customerId = cust.id;
              }

              const enquiryNumber = await generateUniqueEnquiryNumber();

              await tx.enquiry.create({
                data: {
                  enquiryNumber,
                  date: dateVal || new Date(),
                  source,
                  customerId,
                  company,
                  contactPerson,
                  mobile,
                  email,
                  productInterested,
                  budget,
                  city,
                  state,
                  specification,
                  remarks,
                  assignedTo: user.id, // current user always (managers can reassign later)
                  createdBy: user.id,
                  status,
                  leadScore: leadScore ?? 50,
                },
              });
              inserted++;
            } else {
              // entity === "customer"
              if (!company) {
                failed++;
                errors.push({ row: i + 1, error: "Missing required field: company" });
                continue;
              }
              if (!contactPerson) {
                failed++;
                errors.push({ row: i + 1, error: "Missing required field: contactPerson" });
                continue;
              }
              if (!mobile) {
                failed++;
                errors.push({ row: i + 1, error: "Missing required field: mobile" });
                continue;
              }

              const address = pick(row, mapping, "address") || null;
              const industry = pick(row, mapping, "industry") || null;
              const gstin = pick(row, mapping, "gstin") || null;
              const website = pick(row, mapping, "website") || null;

              // Duplicate check (mobile/email/gstin)
              const dupWhere: any[] = [{ mobile }];
              if (email) dupWhere.push({ email });
              if (gstin) dupWhere.push({ gstin });
              const dup = await tx.customer.findFirst({
                where: { OR: dupWhere },
                select: { id: true },
              });
              if (dup) {
                failed++;
                errors.push({
                  row: i + 1,
                  error: "Duplicate customer (same mobile/email/gstin already exists)",
                });
                continue;
              }

              await tx.customer.create({
                data: {
                  company,
                  contactPerson,
                  mobile,
                  email,
                  city,
                  state,
                  address,
                  industry,
                  gstin,
                  website,
                  createdBy: user.id,
                },
              });
              inserted++;
            }
          } catch (e: any) {
            failed++;
            errors.push({
              row: i + 1,
              error: String(e?.message || e).slice(0, 200),
            });
          }
        }
      },
      {
        // Generous timeout for large imports (30s)
        timeout: 30000,
      }
    );

    // Single audit entry summarising the import
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "CREATE",
      entity: entity === "enquiry" ? "ENQUIRY" : "CUSTOMER",
      description: `Bulk CSV import (${entity}): ${inserted} inserted, ${failed} failed of ${rows.length} rows`,
      newValue: {
        entity,
        inserted,
        failed,
        errorCount: errors.length,
        total: rows.length,
      },
    });

    return NextResponse.json({
      inserted,
      failed,
      errors: errors.slice(0, 50), // cap error payload
      total: rows.length,
    });
  } catch (err: any) {
    console.error("[import-entities POST] error:", err);
    return NextResponse.json(
      {
        error: "Import failed",
        detail: String(err?.message || err),
        inserted,
        failed,
        errors: errors.slice(0, 50),
        total: rows.length,
      },
      { status: 500 }
    );
  }
}
