import type { Order, OrderItem, Supplier, Article, TenantChannelConfig } from "@prisma/client";

export type OrderWithRelations = Order & {
  supplier: Supplier;
  items: Array<OrderItem & { article: Pick<Article, "sku" | "name" | "orderUnit" | "baseUnit"> }>;
};

export type DispatchInput = {
  order: OrderWithRelations;
  tenantCfg: TenantChannelConfig | null;
  pdfBuffer: Buffer;
};

export type DispatchResult = {
  channel: "EMAIL" | "API" | "EDI";
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
};
