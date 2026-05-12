import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { appendAudit } from "@/lib/audit/append";
import { orderService } from "@/lib/services/order-service";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/respond";
import { BulkConfirmSchema } from "@/lib/schemas/order-suggestion";

export const POST = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "USER");
  const body = BulkConfirmSchema.parse(await req.json());

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const result = await prisma.$transaction(async (tx) => {
    // Load all relevant pending suggestions with article and supplier
    const suggestions = await tx.orderSuggestion.findMany({
      where: { tenantId: ctx.tenantId, id: { in: body.ids }, status: "PENDING" },
      include: { article: true },
    });
    if (suggestions.length === 0) return { confirmed: 0, ordersCreated: 0, skipped: body.ids.length, orderNos: [] };

    // Group by supplierId; suggestions without supplierId are skipped (cannot create an order without supplier)
    const bySupplier = new Map<string, typeof suggestions>();
    let skippedNoSupplier = 0;
    for (const s of suggestions) {
      if (!s.supplierId) { skippedNoSupplier++; continue; }
      const list = bySupplier.get(s.supplierId) ?? [];
      list.push(s);
      bySupplier.set(s.supplierId, list);
    }

    let ordersCreated = 0;
    let confirmed = 0;
    const orderNos: string[] = [];

    for (const [supplierId, group] of bySupplier) {
      // Determine unitPrice: ArticleSupplier purchasePrice (for the supplier), fallback 0
      const articleSuppliers = await tx.articleSupplier.findMany({
        where: { supplierId, articleId: { in: group.map((g) => g.articleId) } },
      });
      const priceByArticle = new Map(articleSuppliers.map((as) => [as.articleId, Number(as.purchasePrice)]));

      const items = group.map((s) => ({
        articleId: s.articleId,
        qtyOrderUnit: s.qtyOrderUnit,
        unitPrice: priceByArticle.get(s.articleId) ?? 0,
      }));

      const order = await orderService.create(tx, {
        tenantId: ctx.tenantId,
        supplierId,
        items,
        notes: `Aus Vorschlägen erzeugt (${group.length} Vorschlag/Vorschläge)`,
        createdBy: actorEmail,
        actorId, actorEmail,
        ip: req.headers.get("x-forwarded-for") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
      });
      orderNos.push(order.orderNo);
      ordersCreated++;

      // Mark all suggestions in this group as CONFIRMED
      for (const s of group) {
        await tx.orderSuggestion.update({ where: { id: s.id }, data: { status: "CONFIRMED" } });
        await appendAudit(tx, {
          tenantId: ctx.tenantId, entity: "OrderSuggestion", entityId: s.id, action: "STATUS_CHANGE",
          actorId, actorEmail,
          before: { status: "PENDING" },
          after: { status: "CONFIRMED", orderId: order.id, orderNo: order.orderNo },
        });
        confirmed++;
      }
    }

    return {
      confirmed,
      ordersCreated,
      orderNos,
      skipped: body.ids.length - confirmed,
      skippedNoSupplier,
    };
  });

  if (result.confirmed === 0 && result.ordersCreated === 0) {
    return fail(409, "No actionable suggestions", `${result.skipped} suggestions skipped (no supplier or not PENDING)`);
  }
  return ok(result);
});
