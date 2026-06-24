// MSIH CRM V1.0 — Import / Export API
// Module I: GET exports enquiries/products/users/followups; POST bulk-imports rows
// (defensive per-row try/catch, upsert, audit log).
// Developer: Manoj Dore — MIT License

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

// ---------- Helpers ----------
function enquiryScope(user: { id: string; role: string }): Prisma.EnquiryWhereInput {
  return user.role === "EXECUTIVE" ? { assignedTo: user.id } : {};
}

// ---------- GET: export ----------
// ?type=enquiries|products|users|followups  (omit → return all)
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // undefined → all
  const scope = enquiryScope(user);

  try {
    // Executives cannot export users (PII)
    const canExportUsers = user.role !== "EXECUTIVE";

    const result: Record<string, unknown> = {};

    if (!type || type === "enquiries") {
      result.enquiries = await db.enquiry.findMany({
        where: scope,
        include: {
          assignedExecutive: { select: { name: true } },
          product: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }
    if ((!type || type === "products") ) {
      result.products = await db.product.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      });
    }
    if ((!type || type === "users") && canExportUsers) {
      result.users = await db.user.findMany({
        select: {
          id: true, email: true, name: true, role: true, phone: true,
          employeeId: true, designation: true, city: true, state: true,
          active: true, createdAt: true,
          _count: { select: { enquiries: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }
    if (!type || type === "followups") {
      result.followups = await db.followUp.findMany({
        where: user.role === "EXECUTIVE" ? { createdBy: user.id } : {},
        include: {
          enquiry: { select: { enquiryNumber: true, company: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
    }

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      scope: user.role === "EXECUTIVE" ? "own" : "team",
      ...result,
    });
  } catch (err: any) {
    console.error("[import-export GET] error:", err);
    return NextResponse.json(
      { error: "Export failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

// ---------- POST: import ----------
// Body: { entity: 'enquiries'|'products'|'users', rows: Record<string,any>[] }
// Returns: { imported, skipped, errors }
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entity = body?.entity as string | undefined;
  const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];

  if (!entity || !["enquiries", "products", "users"].includes(entity)) {
    return NextResponse.json(
      { error: "entity must be 'enquiries' | 'products' | 'users'" },
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

  // Users import is admin-only
  if (entity === "users" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only admins may import users" }, { status: 403 });
  }

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  // Count existing for enquiry-number generation
  const existingCount = entity === "enquiries" ? await db.enquiry.count() : 0;
  let seq = existingCount;

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      try {
        if (entity === "enquiries") {
          // Required fields
          const company = String(row.company || "").trim();
          const contactPerson = String(row.contactPerson || "").trim();
          const mobile = String(row.mobile || "").trim();
          const productInterested = String(row.productInterested || "").trim();
          if (!company || !contactPerson || !mobile || !productInterested) {
            skipped++;
            errors.push({ row: i + 1, message: "Missing required field(s): company, contactPerson, mobile, productInterested" });
            continue;
          }

          // Find or create customer
          let customerId: string | undefined = row.customerId || undefined;
          if (!customerId) {
            const existing = await db.customer.findFirst({
              where: { OR: [{ mobile }, ...(row.email ? [{ email: String(row.email) }] : [])] },
            });
            if (existing) customerId = existing.id;
            else {
              const cust = await db.customer.create({
                data: {
                  company,
                  contactPerson,
                  mobile,
                  email: row.email ? String(row.email) : null,
                  city: row.city ? String(row.city) : null,
                  state: row.state ? String(row.state) : null,
                  industry: row.industry ? String(row.industry) : null,
                  createdBy: user.id,
                },
              });
              customerId = cust.id;
            }
          }

          seq++;
          const enquiryNumber = `ENQ-${new Date().getFullYear()}-${String(1001 + seq)}`;

          await db.enquiry.create({
            data: {
              enquiryNumber,
              date: row.date ? new Date(row.date) : new Date(),
              source: row.source ? String(row.source).toUpperCase() : "WEBSITE",
              customerId,
              company,
              contactPerson,
              mobile,
              email: row.email ? String(row.email) : null,
              productInterested,
              productId: row.productId ? String(row.productId) : null,
              budget: row.budget ? parseFloat(row.budget) : null,
              city: row.city ? String(row.city) : null,
              state: row.state ? String(row.state) : null,
              specification: row.specification ? String(row.specification) : null,
              remarks: row.remarks ? String(row.remarks) : null,
              assignedTo: row.assignedTo ? String(row.assignedTo) : user.id,
              createdBy: user.id,
              status: row.status ? String(row.status).toUpperCase() : "NEW",
              nextFollowUpDate: row.nextFollowUpDate ? new Date(row.nextFollowUpDate) : null,
            },
          });
          imported++;
        } else if (entity === "products") {
          const name = String(row.name || "").trim();
          const category = String(row.category || "").trim();
          if (!name || !category) {
            skipped++;
            errors.push({ row: i + 1, message: "Missing required field(s): name, category" });
            continue;
          }
          // Upsert by unique name
          await db.product.upsert({
            where: { name },
            create: {
              name,
              category,
              subCategory: row.subCategory ? String(row.subCategory) : null,
              description: row.description ? String(row.description) : null,
              specifications: row.specifications ? JSON.stringify(row.specifications) : null,
              applications: row.applications ? JSON.stringify(row.applications) : null,
              industries: row.industries ? JSON.stringify(row.industries) : null,
              basePrice: row.basePrice ? parseFloat(row.basePrice) : null,
              unit: row.unit ? String(row.unit) : null,
              active: row.active !== false,
            },
            update: {
              category,
              subCategory: row.subCategory ? String(row.subCategory) : undefined,
              description: row.description ? String(row.description) : undefined,
              basePrice: row.basePrice ? parseFloat(row.basePrice) : undefined,
              unit: row.unit ? String(row.unit) : undefined,
            },
          });
          imported++;
        } else if (entity === "users") {
          const email = String(row.email || "").trim().toLowerCase();
          const name = String(row.name || "").trim();
          if (!email || !name) {
            skipped++;
            errors.push({ row: i + 1, message: "Missing required field(s): email, name" });
            continue;
          }
          const password = await bcrypt.hash(row.password ? String(row.password) : "admin@123", 10);
          // Upsert by unique email
          await db.user.upsert({
            where: { email },
            create: {
              email,
              name,
              password,
              role: row.role ? String(row.role).toUpperCase() : "EXECUTIVE",
              phone: row.phone ? String(row.phone) : null,
              employeeId: row.employeeId ? String(row.employeeId) : null,
              designation: row.designation ? String(row.designation) : null,
              city: row.city ? String(row.city) : null,
              state: row.state ? String(row.state) : null,
            },
            update: {
              name,
              role: row.role ? String(row.role).toUpperCase() : undefined,
              phone: row.phone ? String(row.phone) : undefined,
              designation: row.designation ? String(row.designation) : undefined,
              active: row.active !== undefined ? Boolean(row.active) : undefined,
            },
          });
          imported++;
        }
      } catch (e: any) {
        skipped++;
        errors.push({ row: i + 1, message: String(e?.message || e).slice(0, 200) });
      }
    }

    // Single audit entry summarising the bulk import
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "CREATE",
      entity: entity.toUpperCase().slice(0, -1), // ENQUIRY | PRODUCT | USER
      description: `Bulk import ${entity}: ${imported} imported, ${skipped} skipped, ${errors.length} errors`,
      newValue: { entity, imported, skipped, errorCount: errors.length, totalRows: rows.length },
    });

    return NextResponse.json({
      imported,
      skipped,
      errors: errors.slice(0, 50), // cap error payload
      errorCount: errors.length,
      totalRows: rows.length,
    });
  } catch (err: any) {
    console.error("[import-export POST] error:", err);
    return NextResponse.json(
      { error: "Import failed", detail: String(err?.message || err), imported, skipped, errors: errors.slice(0, 50) },
      { status: 500 }
    );
  }
}
