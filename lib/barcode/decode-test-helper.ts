import { inflateSync } from "node:zlib";
import {
  BinaryBitmap,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} from "@zxing/library";

/** Nur für Tests: decodiert ein 8-Bit-RGBA-PNG (ohne Interlace) ohne zusätzliche Abhängigkeit. */
export function decodePngRgba(png: Buffer): { width: number; height: number; rgba: Uint8Array } {
  let off = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString("ascii", off + 4, off + 8);
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error("nur 8-Bit-RGBA ohne Interlace");
    } else if (type === "IDAT") idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  return { width, height, rgba: out };
}

/** Nur für Tests: liest den Text eines QR-Code-PNG mit ZXing. */
export function decodeQrPng(png: Buffer): string {
  const { width, height, rgba } = decodePngRgba(png);
  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0; i < lum.length; i++) {
    const a = rgba[i * 4 + 3] / 255;
    // transparenter Hintergrund zählt als weiß
    const l = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    lum[i] = Math.round(l * a + 255 * (1 - a));
  }
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, width, height)));
  return new QRCodeReader().decode(bitmap).getText();
}
