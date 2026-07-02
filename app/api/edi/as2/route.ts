import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { as2Service } from "@/lib/services/as2-service";

/**
 * AS2 endpoint (RFC 4130): partners POST S/MIME-encrypted+signed EDIFACT here;
 * the response is a SIGNED synchronous MDN. Addressing runs over AS2-From/
 * AS2-To headers (no token in the URL — trust is certificate-based).
 */

const MAX_BYTES = 2_000_000;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BYTES) {
    return new NextResponse("Payload zu groß (max 2 MB)", { status: 413 });
  }

  const result = await as2Service.processInbound({
    headers: {
      as2From: req.headers.get("as2-from"),
      as2To: req.headers.get("as2-to"),
      messageId: req.headers.get("message-id"),
      contentType: req.headers.get("content-type"),
    },
    rawBody,
  });

  if (result.kind === "plain") {
    return new NextResponse(result.message, { status: result.status });
  }

  return new NextResponse(result.body, {
    status: result.status,
    headers: {
      "Content-Type": result.contentType,
      "AS2-Version": "1.2",
      "AS2-From": result.as2From,
      "AS2-To": result.as2To,
      "Message-ID": `<mdn-${crypto.randomBytes(10).toString("hex")}@docklylogistics>`,
      "MIME-Version": "1.0",
    },
  });
}
