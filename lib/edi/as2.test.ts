import { describe, it, expect, beforeAll } from "vitest";
import forge from "node-forge";
import {
  generateAs2Identity,
  certificateFingerprint,
  signPayload,
  headerParam,
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

  it("verifiziert Latin-1-Inhalte (EDIFACT UNOC von SAP) ohne 'URI malformed'", () => {
    // SAP signiert rohe Latin-1-Bytes (UNOC-Zeichensatz) — kein gültiges UTF-8.
    // Umlaute bewusst per charCode (0xF6=ö, 0xFC=ü), nicht als Literal.
    const latin1Edifact =
      "UNB+UNOC:3+4333228000009:14+4170000041474:14+260706:1715+IC1'" +
      "IMD+F++:::K" + String.fromCharCode(0xf6) + "rnerb" + String.fromCharCode(0xfc) + "rli'";
    const content = `Content-Type: application/edi-edifact\r\n\r\n${latin1Edifact}`;

    // Signatur über exakt diese Bytes (Nachbau der SAP-Seite mit forge):
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(content, "binary" as forge.Encoding);
    const cert = forge.pki.certificateFromPem(us.certificatePem);
    p7.addCertificate(cert);
    p7.addSigner({
      key: forge.pki.privateKeyFromPem(us.privateKeyPem) as unknown as string,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
      ],
    });
    p7.sign({ detached: true });
    const sigB64 = forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());

    const B = "TESTBOUND-latin1";
    const body =
      `--${B}\r\n${content}\r\n--${B}\r\n` +
      `Content-Type: application/pkcs7-signature; name="smime.p7s"\r\n\r\n` +
      `${sigB64}\r\n--${B}--\r\n`;
    const ct = `multipart/signed; protocol="application/pkcs7-signature"; micalg=sha-256; boundary="${B}"`;

    const v = verifySignedMime(body, ct, us.certificatePem);
    expect(v.payload).toBe(latin1Edifact); // Bytes unverändert durchgereicht
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

  it("decrypts a raw binary body (Content-Transfer-Encoding: binary, wie SAP/Dohle)", () => {
    const signed = signPayload(EDIFACT, "application/edifact", us);
    const enc = encryptMime(signed.body, signed.contentType, partner.certificatePem);
    // Base64 → rohe DER-Bytes (latin1-Binärstring), wie die Route sie byte-treu liefert.
    const binaryDer = forge.util.decode64(enc.body.replace(/[\r\n\s]/g, ""));
    const dec = decryptMime(binaryDer, partner);
    expect(dec.contentType).toContain("multipart/signed");
    expect(verifySignedMime(dec.body, dec.contentType, us.certificatePem).payload).toBe(EDIFACT);
  });

  it("verarbeitet SAP-style GEFALTETE MIME-Header (Dohle: 'multipart/signed ohne boundary')", () => {
    const signed = signPayload(EDIFACT, "application/edi-edifact", us);
    const boundary = headerParam(signed.contentType, "boundary")!;
    // Äußerer Content-Type über drei Zeilen gefaltet (Tab-Fortsetzung) — exakt
    // das Format aus dem echten Dohle-Payload vom 06.07.2026:
    const foldedCt =
      `multipart/signed; \r\n\tboundary="${boundary}"; \r\n\tprotocol="application/pkcs7-signature"; micalg=sha256`;
    // Zusätzlich den (unsignierten) Signatur-Part-Header falten:
    const foldedBody = signed.body.replace(
      `Content-Type: application/pkcs7-signature; name="smime.p7s"`,
      `Content-Type: application/pkcs7-signature;\r\n\tname="smime.p7s"`,
    );
    expect(foldedBody).not.toBe(signed.body); // Faltung wurde wirklich eingebaut

    const enc = encryptMime(foldedBody, foldedCt, partner.certificatePem);
    const dec = decryptMime(enc.body, partner);
    expect(dec.contentType).toContain(`boundary="${boundary}"`); // entfaltet gefunden

    const verified = verifySignedMime(dec.body, dec.contentType, us.certificatePem);
    expect(verified.payload).toBe(EDIFACT);
    // MIC läuft über die exakten übertragenen Bytes = die signierten Bytes:
    expect(verified.micBase64).toBe(signed.micBase64);
  });

  it("tolerates trailing padding bytes after the CMS structure", () => {
    const signed = signPayload(EDIFACT, "application/edifact", us);
    const enc = encryptMime(signed.body, signed.contentType, partner.certificatePem);
    const der = forge.util.decode64(enc.body.replace(/[\r\n\s]/g, ""));
    const padded = der + String.fromCharCode(0, 0, 0); // NUL-Trailer hinter der Struktur
    // Strikt geparst hieße das "Unparsed DER bytes remain" — einmal Base64, einmal binär:
    expect(decryptMime(forge.util.encode64(padded), partner).contentType).toContain("multipart/signed");
    expect(decryptMime(padded, partner).contentType).toContain("multipart/signed");
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

  it("builds a duplicate warning-MDN that still counts as processed", () => {
    const mdn = buildSignedMdn({
      originalMessageId: "<dup-1@dockly>",
      as2From: "US", as2To: "PARTNER", micBase64: null,
      disposition: { processed: true, warning: "duplicate-document: bereits empfangen" },
      signer: us,
    });
    const parsed = parseMdn(mdn.body, mdn.contentType, us.certificatePem);
    expect(parsed.processed).toBe(true);
    expect(parsed.disposition).toContain("warning");
    expect(parsed.disposition).toContain("duplicate-document");
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
