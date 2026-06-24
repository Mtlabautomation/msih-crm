import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const product = await db.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const enquiryCount = await db.enquiry.count({ where: { productId: id } });
  const convertedCount = await db.enquiry.count({ where: { productId: id, status: "CONVERTED" } });

  return NextResponse.json({ product, enquiryCount, convertedCount });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const existing = await db.product.findUnique({ where: { id } });

  const product = await db.product.update({
    where: { id },
    data: {
      ...body,
      specifications: body.specifications ? JSON.stringify(body.specifications) : undefined,
      applications: body.applications ? JSON.stringify(body.applications) : undefined,
      industries: body.industries ? JSON.stringify(body.industries) : undefined,
      basePrice: body.basePrice !== undefined ? parseFloat(body.basePrice) : undefined,
    },
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "PRODUCT",
    entityId: id,
    description: `Updated product ${existing?.name}`,
  });

  return NextResponse.json({ product });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await db.product.findUnique({ where: { id } });
  // Soft delete
  await db.product.update({ where: { id }, data: { active: false } });
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: "PRODUCT",
    entityId: id,
    description: `Deactivated product ${existing?.name}`,
  });
  return NextResponse.json({ success: true });
}
