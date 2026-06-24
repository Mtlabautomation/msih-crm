// MSIH CRM V1.0 — One-time Setup Endpoint
// Use this to seed the production database after deploying to Vercel.
//
// Usage (after deploy):
//   POST https://your-app.vercel.app/api/setup?secret=YOUR_SETUP_SECRET
//
// Safety:
//   - Refuses to run if the database already has users (prevents re-seeding)
//   - Requires SETUP_SECRET env var to match the ?secret= query param
//   - Idempotent for Settings (uses upsert) but will refuse if users exist
//
// Developer: Manoj Dore — MetTechnik Pvt. Ltd. — MIT License

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { main as runSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel: allow up to 60s for seeding

export async function POST(req: NextRequest) {
  // 1. Check the secret
  const secret = req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.SETUP_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "SETUP_SECRET environment variable is not configured. Add it in your Vercel project settings." },
      { status: 400 }
    );
  }
  if (secret !== expectedSecret) {
    return NextResponse.json(
      { error: "Invalid secret. Pass ?secret=YOUR_SETUP_SECRET matching the SETUP_SECRET env var." },
      { status: 403 }
    );
  }

  // 2. Refuse if database already has users (prevent accidental re-seed)
  try {
    const userCount = await db.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        {
          ok: true,
          alreadySeeded: true,
          message: `Database already has ${userCount} users. Seeding was skipped to prevent data duplication.`,
          userCount,
        },
        { status: 200 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Database schema not initialized.",
        detail: e?.message || String(e),
        hint: "Run 'prisma db push' against your production database. Easiest: use the Vercel CLI 'vercel env pull && npx prisma db push' OR run the SQL from prisma/migrations against your Postgres via its web console.",
      },
      { status: 500 }
    );
  }

  // 3. Run the seed
  try {
    await runSeed();
    const userCount = await db.user.count();
    return NextResponse.json({
      ok: true,
      alreadySeeded: false,
      message: "Database seeded successfully! You can now log in with the demo credentials.",
      userCount,
      demoCredentials: {
        superadmin: "superadmin@mettechnik.com",
        admin: "admin@mettechnik.com",
        manager: "manager@mettechnik.com",
        executive1: "rohit@mettechnik.com",
        executive2: "priya@mettechnik.com",
        executive3: "amit@mettechnik.com",
        password: "admin@123",
      },
      nextStep: "Visit / and sign in. Then DELETE this /api/setup route for production safety.",
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Seeding failed.",
        detail: e?.message || String(e),
      },
      { status: 500 }
    );
  } finally {
    await db.$disconnect();
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
