import { describe, it, expect, beforeAll } from "vitest";
import {
  generateAs2Identity,
  certificateFingerprint,
  signPayload,
  verifySignedMime,
  encryptMime,
  decryptMime,
  buildSignedMdn,
  parseMdn,
  computeMic,
  type As2Identity,
} from "./as2";

const EDIFACT =
  "UNA:+.? '\nUNB+UNOC:3+4170000041474:14+4012345000009:14+260702:1200+ICAS2X'\n" +
  "UNH+MEAS2X+ORDERS:D:96A:UN'\nBGM+220+AS2-TEST-1+9'\nIMD+F++:::Bäcker ?+ Söhne'\nUNT+4+MEAS2X'\nUNZ+1+ICAS2X'";

let us: As2Identity;
let partner: As2Identity;

beforeAll(() => {
  us = generateAs2Identity("brotmanufaktur-schmidt");
  partner = generateAs2Identity("partner-mill");
});

describe("AS2 identity", () => {
  it("generates a usable self-signed certificate with fingerprint", () => {
    expect(us.privateKeyPem).toContain("BEGIN RSA PRIVATE KEY");
    expect(us.certificatePem).toContain("BEGIN CERTIFICATE");
    const fp = certificateFingerprint(us.certificatePem);
    expect(fp).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });
});

describe("sign + verify (multipart/signed, pinned cert)", () => {
  it("round-trips and preserves the payload incl. umlauts", () => {
    const signed = signPayload(EDIFACT, "application/edifact", us);
    const verified = verifySignedMime(signed.body, signed.contentType, us.certificatePem);
    expect(verified.payload).toBe(EDIFACT);
    expect(verified.payloadContentType).toContain("application/edifact");
    expect(verified.micBase64).toBe(signed.micBase64);
  });

  it("rejects verification with the wrong (unpinned) certificate", () => {
    const signed = signPayload(EDIFACT, "application/edifact", us);
    expect(() => verifySignedMime(signed.body, signed.contentType, partner.certificatePem)).toThrow(
      /Signaturprüfung/,
    );
  });

  it("rejects a tampered payload", () => {
    const signed = signPayload(EDIFACT, "application/edifact", us);
    const tampered = signed.body.replace("AS2-TEST-1", "AS2-EVIL-1");
    expect(() => verifySignedMime(tampered, signed.contentType, us.certificatePem)).toThrow(
      /verändert|Signaturprüfung/,
    );
  });
});

describe("encrypt + decrypt (enveloped-data AES-256)", () => {
  it("round-trips a signed container", () => {
    const signed = signPayload(EDIFACT, "application/edifact", us);
    const enc = encryptMime(signed.body, signed.contentType, partner.certificatePem);
    expect(enc.contentType).toContain("enveloped-data");

    const dec = decryptMime(enc.body, partner);
    expect(dec.contentType).toContain("multipart/signed");
    const verified = verifySignedMime(dec.body, dec.contentType, us.certificatePem);
    expect(verified.payload).toBe(EDIFACT);
  });

  it("refuses to decrypt for the wrong recipient", () => {
    const enc = encryptMime("hallo", "text/plain", partner.certificatePem);
    expect(() => decryptMime(enc.body, us)).toThrow(/nicht an dieses Zertifikat/);
  });
});

describe("MDN build + parse", () => {
  it("builds a signed processed-MDN that parses and verifies", () => {
    const mic = computeMic("beliebiger-kanonischer-inhalt");
    const mdn = buildSignedMdn({
      originalMessageId: "<msg-123@dockly>",
      as2From: "BROTMANUFAKTUR",
      as2To: "PARTNER",
      micBase64: mic,
      disposition: { processed: true },
      signer: us,
    });
    const parsed = parseMdn(mdn.body, mdn.contentType, us.certificatePem);
    expect(parsed.processed).toBe(true);
    expect(parsed.micBase64).toBe(mic);
    expect(parsed.originalMessageId).toBe("<msg-123@dockly>");
  });

  it("builds a failure-MDN with readable error", () => {
    const mdn = buildSignedMdn({
      originalMessageId: "<msg-456@dockly>",
      as2From: "BROTMANUFAKTUR",
      as2To: "PARTNER",
      micBase64: null,
      disposition: { processed: false, error: "Signaturprüfung fehlgeschlagen" },
      signer: us,
    });
    const parsed = parseMdn(mdn.body, mdn.contentType, us.certificatePem);
    expect(parsed.processed).toBe(false);
    expect(parsed.disposition).toContain("error");
  });

  it("rejects an MDN signed by the wrong party", () => {
    const mdn = buildSignedMdn({
      originalMessageId: "<msg-789@dockly>",
      as2From: "X", as2To: "Y", micBase64: null,
      disposition: { processed: true },
      signer: partner,
    });
    expect(() => parseMdn(mdn.body, mdn.contentType, us.certificatePem)).toThrow();
  });
});
