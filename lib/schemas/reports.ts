import { z } from "zod";
import { registry } from "@/lib/api/openapi";

registry.registerPath({
  method: "get",
  path: "/reports/summary",
  summary: "Bestell-KPIs + Volume je Lieferant",
  tags: ["Reports"],
  request: {
    query: z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }),
  },
  responses: { 200: { description: "KPIs" } },
});

registry.registerPath({
  method: "get",
  path: "/reports/export.csv",
  summary: "Bestellungen als CSV exportieren",
  tags: ["Reports"],
  request: {
    query: z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }),
  },
  responses: {
    200: { description: "CSV-Datei", content: { "text/csv": { schema: z.string() } } },
  },
});
