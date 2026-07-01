import {
  parseInterchange,
  findSeg,
  findSegs,
  type ParsedInterchange,
  type EdiSegment,
} from "./edifact";

/**
 * Inbound mappers: raw EDIFACT → structured data for the two message types we
 * process. Everything returns plain serializable objects (stored as
 * EdiMessage.parsed for the monitor).
 */

export type InboundOrdrsp = {
  type: "ORDRSP";
  documentNo: string | null;      // BGM document number
  /** Purchase-order reference (RFF+ON) — our order number. */
  orderReference: string | null;
  /** BGM response code (DE 4343): 27=rejected, 29=accepted, AC=ack w/ changes … */
  responseCode: string | null;
  senderId: string | null;
};

export type InboundOrdersLine = {
  lineNo: number;
  ean: string | null;
  sku: string | null;
  name: string | null;
  qty: number | null;
  unit: string | null;
  price: number | null;
};

export type InboundOrders = {
  type: "ORDERS";
  documentNo: string | null;
  buyerId: string | null;    // NAD+BY
  supplierId: string | null; // NAD+SU
  currency: string | null;
  orderDate: string | null;  // DTM+137 raw value
  lines: InboundOrdersLine[];
};

export type ClassifiedInbound =
  | { kind: "ORDRSP"; data: InboundOrdrsp; interchange: ParsedInterchange }
  | { kind: "ORDERS"; data: InboundOrders; interchange: ParsedInterchange }
  | { kind: "UNKNOWN"; messageType: string | null; interchange: ParsedInterchange };

function num(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function nadId(segments: EdiSegment[], party: string): string | null {
  const nad = segments.find((s) => s.tag === "NAD" && s.elements[0]?.[0] === party);
  return nad?.elements[1]?.[0] ?? null;
}

export function mapOrdrsp(msgSegments: EdiSegment[], envelope: ParsedInterchange["envelope"]): InboundOrdrsp {
  const bgm = findSeg(msgSegments, "BGM");
  const rffOn = findSegs(msgSegments, "RFF").find((s) => s.elements[0]?.[0] === "ON");
  return {
    type: "ORDRSP",
    documentNo: bgm?.elements[1]?.[0] ?? null,
    orderReference: rffOn?.elements[0]?.[1] ?? bgm?.elements[1]?.[0] ?? null,
    responseCode: bgm?.elements[2]?.[0] ?? null,
    senderId: envelope?.senderId ?? null,
  };
}

export function mapOrders(msgSegments: EdiSegment[]): InboundOrders {
  const bgm = findSeg(msgSegments, "BGM");
  const dtm137 = findSegs(msgSegments, "DTM").find((s) => s.elements[0]?.[0] === "137");
  const cux = findSeg(msgSegments, "CUX");

  const lines: InboundOrdersLine[] = [];
  let current: InboundOrdersLine | null = null;
  for (const s of msgSegments) {
    if (s.tag === "LIN") {
      if (current) lines.push(current);
      const itemId = s.elements[2]?.[0] ?? null;
      const itemQual = s.elements[2]?.[1] ?? null;
      current = {
        lineNo: Number(s.elements[0]?.[0] ?? lines.length + 1) || lines.length + 1,
        ean: itemQual === "EN" ? itemId : null,
        sku: itemQual === "SA" ? itemId : null,
        name: null,
        qty: null,
        unit: null,
        price: null,
      };
      continue;
    }
    if (!current) continue;
    switch (s.tag) {
      case "PIA": {
        // PIA+5+<id>:<qual> — additional identification (we emit SKU here)
        const id = s.elements[1]?.[0];
        const qual = s.elements[1]?.[1];
        if (qual === "SA" && id) current.sku = id;
        if (qual === "EN" && id && !current.ean) current.ean = id;
        break;
      }
      case "IMD": {
        const desc = s.elements[2]?.[3] ?? s.elements[2]?.[0];
        if (desc) current.name = desc;
        break;
      }
      case "QTY": {
        if (s.elements[0]?.[0] === "21") {
          current.qty = num(s.elements[0]?.[1]);
          current.unit = s.elements[0]?.[2] ?? null;
        }
        break;
      }
      case "PRI": {
        if (s.elements[0]?.[0] === "AAA") current.price = num(s.elements[0]?.[1]);
        break;
      }
      case "UNS":
        lines.push(current);
        current = null;
        break;
    }
  }
  if (current) lines.push(current);

  return {
    type: "ORDERS",
    documentNo: bgm?.elements[1]?.[0] ?? null,
    buyerId: nadId(msgSegments, "BY"),
    supplierId: nadId(msgSegments, "SU"),
    currency: cux?.elements[0]?.[1] ?? null,
    orderDate: dtm137?.elements[0]?.[1] ?? null,
    lines,
  };
}

/** Parse + classify a raw inbound interchange. Throws only on unparseable input. */
export function classifyInbound(raw: string): ClassifiedInbound {
  const interchange = parseInterchange(raw);
  const first = interchange.messages[0];
  const type = first?.type?.toUpperCase() ?? null;

  if (type === "ORDRSP" && first) {
    return { kind: "ORDRSP", data: mapOrdrsp(first.segments, interchange.envelope), interchange };
  }
  if (type === "ORDERS" && first) {
    return { kind: "ORDERS", data: mapOrders(first.segments), interchange };
  }
  return { kind: "UNKNOWN", messageType: type, interchange };
}
