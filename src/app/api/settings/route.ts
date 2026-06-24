import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// Default settings (used when no Setting rows exist yet)
const DEFAULT_SETTINGS: Record<string, string> = {
  companyName: "MetTechnik Pvt. Ltd.",
  companyAddress: "Plot No. 24, MIDC Bhosari, Pune - 411026, Maharashtra, India",
  companyPhone: "+91 98765 43210",
  companyEmail: "info@mettechnik.com",
  gstin: "27AABCM1234L1Z5",
  currency: "INR",
  currencySymbol: "₹",
  taxRate: "18",
  lowStockThreshold: "5",
  followUpReminderDays: "1",
  quotationValidityDays: "30",
  leadScoreThreshold: "70",
  developer: "Manoj Dore",
  version: "V1.0",
};

// GET /api/settings — return all settings as key-value map (with defaults merged)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.setting.findMany();
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) settings[r.key] = r.value;

  return NextResponse.json({ settings });
}

// PATCH /api/settings — upsert settings (ADMIN only)
// Body: { key, value } OR { settings: [{key, value}] }
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden — only Admin can update settings" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const entries: Array<{ key: string; value: string }> = [];

    if (Array.isArray(body.settings)) {
      entries.push(...body.settings);
    } else if (body.key) {
      entries.push({ key: body.key, value: String(body.value ?? "") });
    } else {
      return NextResponse.json({ error: "Provide { key, value } or { settings: [{key, value}] }" }, { status: 400 });
    }

    const results: Array<{ id: string; key: string; value: string }> = [];
    for (const { key, value } of entries) {
      if (!key) continue;
      const setting = await db.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
      results.push(setting);
    }

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "UPDATE",
      entity: "SETTING",
      description: `Updated ${results.length} setting(s): ${results.map((r) => r.key).join(", ")}`,
      newValue: Object.fromEntries(results.map((r) => [r.key, r.value])),
    });

    // Return merged settings
    const rows = await db.setting.findMany();
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const r of rows) settings[r.key] = r.value;

    return NextResponse.json({ settings, updated: results.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
