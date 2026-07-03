/**
 * Order → XML renderer for the SFTP inbox (what the Warenwirtschaft reads).
 * A clean, self-describing house format — deliberately simple so a WaWi import
 * is trivial, and easy to swap for a partner-specific schema later.
 */

export type OrderXmlInput = {
  documentNo: string;
  orderDate?: string | null; // ISO or EDIFACT date; passed through as-is
  currency?: string | null;
  buyerId?: string | null;
  supplierId?: string | null;
  source?: string | null; // e.g. "edi-inbound" | "dockly"
  lines: Array<{
    lineNo: number;
    ean?: string | null;
    sku?: string | null;
    name?: string | null;
    qty?: number | null;
    unit?: string | null;
    price?: number | null;
  }>;
};

/** Escape the five XML entities; drop control chars invalid in XML 1.0. */
export function escapeXml(value: string): string {
  let clean = "";
  for (const ch of value) {
    const c = ch.codePointAt(0) ?? 0;
    // XML 1.0 allows tab (0x09), LF (0x0A), CR (0x0D) and anything >= 0x20.
    if (c === 0x09 || c === 0x0a || c === 0x0d || c >= 0x20) clean += ch;
  }
  return clean
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tag(name: string, value: string | number | null | undefined, indent: string): string {
  if (value === null || value === undefined || value === "") return "";
  return `${indent}<${name}>${escapeXml(String(value))}</${name}>\n`;
}

export function renderOrderXml(input: OrderXmlInput): string {
  let out = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  out += `<Order xmlns="urn:docklylogistics:order:1.0">\n`;
  out += `  <Header>\n`;
  out += tag("DocumentNo", input.documentNo, "    ");
  out += tag("OrderDate", input.orderDate, "    ");
  out += tag("Currency", input.currency ?? "EUR", "    ");
  out += tag("BuyerId", input.buyerId, "    ");
  out += tag("SupplierId", input.supplierId, "    ");
  out += tag("Source", input.source, "    ");
  out += `  </Header>\n`;
  out += `  <Lines>\n`;
  for (const l of input.lines) {
    out += `    <Line number="${escapeXml(String(l.lineNo))}">\n`;
    out += tag("EAN", l.ean, "      ");
    out += tag("SKU", l.sku, "      ");
    out += tag("Name", l.name, "      ");
    out += tag("Quantity", l.qty, "      ");
    out += tag("Unit", l.unit, "      ");
    out += tag("Price", l.price, "      ");
    out += `    </Line>\n`;
  }
  out += `  </Lines>\n`;
  out += `</Order>\n`;
  return out;
}
