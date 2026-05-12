import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { publicHandler } from "@/lib/api/public-handler";
import { authenticatePublic } from "@/lib/api/public-auth";
import { ok } from "@/lib/api/respond";
import { PublicOrderListQuerySchema } from "@/lib/schemas/public-api";

export const GET = publicHandler(async (req: NextRequest) => {
  const ctx = await authenticatePublic(req.headers, "orders:read");
  const q = PublicOrderListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  const where = {
    tenantId: ctx.tenantId,
    supplierId: ctx.supplierId,
    ...(q.status ? { status: q.status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            article: {
              select: { sku: true, name: true, orderUnit: true, baseUnit: true },
            },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  // Project to a public view (omit internal fields like createdBy, pdfPath, pdfHash, tenantId)
  const data = items.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    currency: o.currency,
    total: Number(o.total),
    sentAt: o.sentAt,
    notes: o.notes,
    items: o.items.map((it) => ({
      id: it.id,
      sku: it.article.sku,
      name: it.article.name,
      qtyOrderUnit: it.qtyOrderUnit,
      orderUnit: it.article.orderUnit,
      unitPrice: Number(it.unitPrice),
      lineTotal: Number(it.lineTotal),
    })),
  }));

  return ok(data, { page: q.page, pageSize: q.pageSize, total });
});
