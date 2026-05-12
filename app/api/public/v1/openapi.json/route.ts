import { NextResponse } from "next/server";
import { buildPublicOpenApi } from "@/lib/schemas/public-api";

export const dynamic = "force-static";

export function GET() {
  const doc = buildPublicOpenApi();
  return NextResponse.json(doc, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": "application/json",
    },
  });
}
