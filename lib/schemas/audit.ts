import { z } from "zod";
import { registry } from "@/lib/api/openapi";

registry.registerPath({
  method: "get",
  path: "/audit",
  summary: "Audit-Log auflisten",
  tags: ["Audit"],
  request: {
    query: z.object({
      entity: z.string().optional(),
      action: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(50),
    }),
  },
  responses: { 200: { description: "Liste" } },
});

registry.registerPath({
  method: "get",
  path: "/audit/verify",
  summary: "Hash-Chain für Datum verifizieren",
  tags: ["Audit"],
  request: {
    query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  },
  responses: {
    200: { description: "VerifyResult (ok | mismatch)" },
    422: { description: "Datum ungültig" },
  },
});
