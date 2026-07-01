import { seg, DEFAULT_SERVICE_CHARS } from "./edifact";

/**
 * EDIFACT ORDERS D.96A generator — the outbound purchase order we send to a
 * supplier. Input is deliberately decoupled from Prisma so the channel maps
 * its own data in and tests stay plain.
 */

export type GenerateOrdersInput = {
  orderNo: string;
  currency: string;
  /** Order date for DTM+137. */
  orderDate: Date;
  items: Array<{
    sku: string;
    name: string;
    ean?: string | null;
    qtyOrderUnit: number;
    /** Prisma UnitKind (PIECE, KG, …) — mapped to UN Rec 20 codes. */
    orderUnit: string;
    unitPrice: number;
  }>;
  sender: { id: string; qualifier: string };
  recipient: { id: string; qualifier: string };
  /** Injectable for deterministic tests; defaults derive from `orderDate`+orderNo. */
  refs?: { interchangeRef?: string; messageRef?: string };
};

export type GeneratedOrders = {
  payload: string;
  interchangeRef: string;
  messageRef: string;
  documentNo: string;
  /** Segment count UNH..UNT inclusive (the UNT value). */
  segmentCount: number;
};

/** Prisma UnitKind → UN/ECE Recommendation 20 unit code. */
export const UNIT_TO_REC20: Record<string, string> = {
  PIECE: "PCE",
  KG: "KGM",
  G: "GRM",
  L: "LTR",
  ML: "MLT",
  PACK: "PK",
  SACK: "SA",
  BOX: "BX",
  PALLET: "PF",
  OTHER: "PCE",
};

function two(n: number): string {
  return String(n).padStart(2, "0");
}

/** Plain decimal string with "." separator, max 4 fraction digits, no exponent. */
export function formatEdiNumber(n: number): string {
  const s = n.toFixed(4);
  return s.replace(/\.?0+$/, "") || "0";
}

function sanitizeRef(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 14) || "REF1";
}

export function generateOrdersEdifact(input: GenerateOrdersInput): GeneratedOrders {
  const sc = DEFAULT_SERVICE_CHARS;
  const d = input.orderDate;
  const yymmdd = `${two(d.getUTCFullYear() % 100)}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}`;
  const ccyymmdd = `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}`;
  const hhmm = `${two(d.getUTCHours())}${two(d.getUTCMinutes())}`;

  const interchangeRef = sanitizeRef(input.refs?.interchangeRef ?? `IC${input.orderNo}`);
  const messageRef = sanitizeRef(input.refs?.messageRef ?? `ME${input.orderNo}`);

  const head: string[] = [];
  head.push(`UNA${sc.component}${sc.element}${sc.decimal}${sc.release} ${sc.segment}`);
  head.push(
    seg("UNB", [
      ["UNOC", "3"],
      [input.sender.id, input.sender.qualifier],
      [input.recipient.id, input.recipient.qualifier],
      [yymmdd, hhmm],
      interchangeRef,
    ]),
  );

  // Message block — counted for UNT (UNH..UNT inclusive).
  const msg: string[] = [];
  msg.push(seg("UNH", [messageRef, ["ORDERS", "D", "96A", "UN"]]));
  msg.push(seg("BGM", ["220", input.orderNo, "9"]));
  msg.push(seg("DTM", [["137", ccyymmdd, "102"]]));
  msg.push(seg("NAD", ["BY", [input.sender.id, "", "9"]]));
  msg.push(seg("NAD", ["SU", [input.recipient.id, "", "9"]]));
  msg.push(seg("CUX", [["2", input.currency, "9"]]));

  let lineNo = 0;
  for (const it of input.items) {
    lineNo++;
    const hasEan = !!it.ean && it.ean.trim().length > 0;
    msg.push(
      seg("LIN", [
        String(lineNo),
        "",
        hasEan ? [it.ean!.trim(), "EN"] : [it.sku, "SA"],
      ]),
    );
    if (hasEan) {
      msg.push(seg("PIA", ["5", [it.sku, "SA"]]));
    }
    msg.push(seg("IMD", ["F", "", ["", "", "", it.name.slice(0, 70)]]));
    msg.push(
      seg("QTY", [["21", formatEdiNumber(it.qtyOrderUnit), UNIT_TO_REC20[it.orderUnit] ?? "PCE"]]),
    );
    msg.push(seg("PRI", [["AAA", formatEdiNumber(it.unitPrice)]]));
  }

  msg.push(seg("UNS", ["S"]));
  msg.push(seg("CNT", [["2", String(lineNo)]]));
  const segmentCount = msg.length + 1; // + the UNT segment itself
  msg.push(seg("UNT", [String(segmentCount), messageRef]));

  const tail = seg("UNZ", ["1", interchangeRef]);
  const payload = [...head, ...msg, tail].join("\n");

  return { payload, interchangeRef, messageRef, documentNo: input.orderNo, segmentCount };
}
