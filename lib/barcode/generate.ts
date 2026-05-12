import bwipjs from "bwip-js/node";

export type BarcodeFormat = "code128" | "ean13";
export type BarcodeSource = "SKU" | "EAN";

export type BarcodeResult = {
  format: BarcodeFormat;
  value: string;
  svg: string;
  pngBase64: string;
};

/**
 * Compute EAN-13 check digit. Input must be exactly 12 numeric digits.
 * Returns the 13-digit code including the check digit at the end.
 */
export function withEan13Checksum(twelveDigits: string): string {
  if (!/^\d{12}$/.test(twelveDigits)) {
    throw new Error("EAN-13 input must be 12 numeric digits");
  }
  const digits = twelveDigits.split("").map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return twelveDigits + String(check);
}

export function validateEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  const digits = value.slice(0, 12).split("").map(Number);
  const check = Number(value[12]);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return ((10 - (sum % 10)) % 10) === check;
}

export type GenerateInput = {
  format: BarcodeFormat;
  source: BarcodeSource;
  sku: string;
  eanGtin?: string | null;
};

export async function generateBarcode(input: GenerateInput): Promise<BarcodeResult> {
  let value: string;

  if (input.format === "code128") {
    value = input.source === "SKU" ? input.sku : (input.eanGtin ?? input.sku);
  } else {
    // ean13
    const raw = input.source === "EAN" ? input.eanGtin : input.sku;
    if (!raw) throw new Error("EAN-13 requires a numeric value (EAN/GTIN missing)");
    const numeric = raw.replace(/\D/g, "");
    if (numeric.length === 12) {
      value = withEan13Checksum(numeric);
    } else if (numeric.length === 13) {
      if (!validateEan13(numeric)) throw new Error("EAN-13 check digit invalid");
      value = numeric;
    } else {
      throw new Error("EAN-13 requires 12 or 13 numeric digits");
    }
  }

  const opts = {
    bcid: input.format,
    text: value,
    scale: 3,
    height: 12,
    includetext: true,
  };

  const png = await bwipjs.toBuffer(opts);
  const svg = bwipjs.toSVG(opts);

  return { format: input.format, value, svg, pngBase64: png.toString("base64") };
}
