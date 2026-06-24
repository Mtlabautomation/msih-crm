import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  const where: Prisma.ProductWhereInput = { active: true };
  if (category && category !== "all") where.category = category;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
      { category: { contains: search } },
    ];
  }

  const products = await db.product.findMany({
    where,
    orderBy: { category: "asc" },
  });

  const categories = await db.product.findMany({
    where: { active: true },
    select: { category: true },
    distinct: ["category"],
  });

  return NextResponse.json({
    products,
    categories: categories.map((c) => c.category),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();

  const product = await db.product.create({
    data: {
      name: body.name,
      category: body.category,
      subCategory: body.subCategory || null,
      description: body.description || null,
      specifications: body.specifications ? JSON.stringify(body.specifications) : null,
      applications: body.applications ? JSON.stringify(body.applications) : null,
      industries: body.industries ? JSON.stringify(body.industries) : null,
      basePrice: body.basePrice ? parseFloat(body.basePrice) : null,
      unit: body.unit || "Unit",
      image: body.image || null,
      active: true,
    },
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "CREATE",
    entity: "PRODUCT",
    entityId: product.id,
    description: `Created product ${product.name} (${product.category})`,
  });

  return NextResponse.json({ product });
}
