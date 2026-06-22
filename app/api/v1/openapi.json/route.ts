import { NextResponse } from "next/server";
import { buildOpenApi } from "@/lib/api/openapi";

// IMPORTANT: side-effect imports so the schemas register their paths.
import "@/lib/schemas/article";
import "@/lib/schemas/supplier";
import "@/lib/schemas/tenant-channel";
import "@/lib/schemas/storage-location";
import "@/lib/schemas/stock";
import "@/lib/schemas/order-suggestion";
import "@/lib/schemas/order";
import "@/lib/schemas/api-key";
import "@/lib/schemas/webhook";
import "@/lib/schemas/audit";
import "@/lib/schemas/reports";
import "@/lib/schemas/misc-routes";

export const dynamic = "force-static";

export function GET() {
  const doc = buildOpenApi();
  return NextResponse.json(doc, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": "application/json",
    },
  });
}
