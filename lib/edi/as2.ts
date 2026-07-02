import crypto from "node:crypto";
import forge from "node-forge";

/**
 * AS2 (RFC 4130) building blocks on top of node-forge:
 *   - self-signed identity certificates (RSA-2048, 5y)
 *   - S/MIME detached signing (multipart/signed, SHA-256) + pinned verification
 *   - S/MIME encryption (envelopedData, AES-256-CBC) + decryption
 *   - MIC (RFC 3335 style, sha256/base64)
 *   - signed synchronous MDNs (multipart/report) — build + parse/validate
 *
 * Scope note: sync MDNs only; compression (RFC 5402) not implemented. All MIME
 * bodies use CRLF; payloads are UTF-8.
 */

const CRLF = "\r\n";

/* ------------------------------------------------------------------ */
/* identity                                                            */
/* ------------------------------------------------------------------ */

export type As2Identity = { privateKeyPem: string; certificatePem: string };

/** Self-signed AS2 certificate — the common practice for point-to-point AS2. */
export function generateAs2Identity(commonName: string): As2Identity {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01" + crypto.randomBytes(15).toString("hex");
  const now = new Date();
  cert.validity.notBefore = new Date(now.getTime() - 24 * 3600 * 1000);
  cert.validity.notAfter = new Date(now.getTime() + 5 * 365 * 24 * 3600 * 1000);
  const attrs = [
    { name: "commonName", value: commonName },
    { name: "organizationName", value: "DocklyLogistics" },
    { shortName: "C", value: "DE" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
    { name: "extKeyUsage", emailProtection: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    certificatePem: forge.pki.certificateToPem(cert),
  };
}

/** SHA-256 fingerprint of a PEM certificate, colon-separated hex. */
export function certificateFingerprint(certificatePem: string): string {
  const cert = forge.pki.certificateFromPem(certificatePem);
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const hash = crypto.createHash("sha256").update(Buffer.from(der, "binary")).digest("hex");
  return hash.toUpperCase().replace(/(..)(?=.)/g, "$1:");
}

/* ------------------------------------------------------------------ */
/* small MIME helpers                                                  */
/* ------------------------------------------------------------------ */

function chunkBase64(b64: string): string {
  return b64.replace(/(.{64})/g, `$1${CRLF}`).trim();
}

function newBoundary(prefix: string): string {
  return `----=_${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

export function headerParam(headerValue: string, param: string): string | null {
  // boundary="..." | boundary=... (case-insensitive)
  const re = new RegExp(`${param}\\s*=\\s*(?:"([^"]+)"|([^;\\s]+))`, "i");
  const m = headerValue.match(re);
  return m ? (m[1] ?? m[2]) : null;
}

type MimePart = { headers: Record<string, string>; body: string };

/** Split a multipart body into parts (raw bodies preserved byte-for-byte). */
export function splitMultipart(body: string, boundary: string): MimePart[] {
  const delim = `--${boundary}`;
  const sections = body.split(delim);
  const parts: MimePart[] = [];
  // first section = preamble, last = "--" epilogue
  for (let i = 1; i < sections.length - 1; i++) {
    let sec = sections[i];
    if (sec.startsWith(CRLF)) sec = sec.slice(2);
    else if (sec.startsWith("\n")) sec = sec.slice(1);
    // strip the trailing CRLF that belongs to the boundary line
    if (sec.endsWith(CRLF)) sec = sec.slice(0, -2);
    else if (sec.endsWith("\n")) sec = sec.slice(0, -1);
    const headerEnd = sec.indexOf(`${CRLF}${CRLF}`);
    const nlHeaderEnd = headerEnd === -1 ? sec.indexOf("\n\n") : -1;
    let headerBlock = "";
    let partBody = sec;
    if (headerEnd !== -1) {
      headerBlock = sec.slice(0, headerEnd);
      partBody = sec.slice(headerEnd + 4);
    } else if (nlHeaderEnd !== -1) {
      headerBlock = sec.slice(0, nlHeaderEnd);
      partBody = sec.slice(nlHeaderEnd + 2);
    }
    const headers: Record<string, string> = {};
    for (const line of headerBlock.split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx > 0) headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }
    parts.push({ headers, body: partBody });
  }
  return parts;
}

/* ------------------------------------------------------------------ */
/* MIC                                                                 */
/* ------------------------------------------------------------------ */

/** RFC 3335-style MIC: base64(sha256(data)). Returned without the ", sha256" suffix. */
export function computeMic(data: string): string {
  return crypto.createHash("sha256").update(Buffer.from(data, "binary")).digest("base64");
}

/* ------------------------------------------------------------------ */
/* signing (multipart/signed, detached)                                */
/* ------------------------------------------------------------------ */

export type SignedMime = {
  /** Full multipart/signed body. */
  body: string;
  /** Content-Type header value incl. boundary/micalg. */
  contentType: string;
  /** MIC over the exact signed (canonical) content part. */
  micBase64: string;
};

/** Wrap a payload as a canonical MIME part and sign it (detached PKCS#7). */
export function signPayload(
  payload: string,
  payloadContentType: string,
  signer: { privateKeyPem: string; certificatePem: string },
): SignedMime {
  // canonical inner part (CRLF, headers + blank line + utf8 payload)
  const content =
    `Content-Type: ${payloadContentType}` + CRLF +
    `Content-Transfer-Encoding: binary` + CRLF + CRLF +
    forge.util.encodeUtf8(payload);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(content, "binary" as forge.Encoding);
  const cert = forge.pki.certificateFromPem(signer.certificatePem);
  const key = forge.pki.privateKeyFromPem(signer.privateKeyPem);
  p7.addCertificate(cert);
  p7.addSigner({
    key: key as unknown as string, // forge typing quirk — accepts a PrivateKey
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest }, // filled by forge
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  const sigDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const sigB64 = chunkBase64(forge.util.encode64(sigDer));

  const boundary = newBoundary("signed");
  const body =
    `--${boundary}` + CRLF +
    content + CRLF +
    `--${boundary}` + CRLF +
    `Content-Type: application/pkcs7-signature; name="smime.p7s"` + CRLF +
    `Content-Transfer-Encoding: base64` + CRLF +
    `Content-Disposition: attachment; filename="smime.p7s"` + CRLF + CRLF +
    sigB64 + CRLF +
    `--${boundary}--` + CRLF;

  return {
    body,
    contentType:
      `multipart/signed; protocol="application/pkcs7-signature"; micalg=sha-256; boundary="${boundary}"`,
    micBase64: computeMic(content),
  };
}

/**
 * Verify a multipart/signed body against a PINNED certificate (embedded certs
 * are ignored — the partner cert on file is the trust anchor). Returns the
 * decoded payload + MIC of the signed part. Throws on any mismatch.
 */
export function verifySignedMime(
  body: string,
  contentTypeHeader: string,
  pinnedCertificatePem: string,
): { payload: string; payloadContentType: string; micBase64: string } {
  const boundary = headerParam(contentTypeHeader, "boundary");
  if (!boundary) throw new Error("multipart/signed ohne boundary");
  const parts = splitMultipart(body, boundary);
  if (parts.length < 2) throw new Error("multipart/signed unvollständig");
  const contentPart = parts[0];
  const sigPart = parts.find((p) => (p.headers["content-type"] ?? "").includes("pkcs7-signature"));
  if (!sigPart) throw new Error("Signatur-Part fehlt");

  // reconstruct the exact signed bytes: headers + CRLF CRLF + body
  const headerLines = Object.entries(contentPart.headers)
    .map(([k, v]) => `${k.replace(/(^|-)([a-z])/g, (m) => m.toUpperCase())}: ${v}`);
  const canonical = headerLines.join(CRLF) + CRLF + CRLF + contentPart.body;

  const sigDer = forge.util.decode64(sigPart.body.replace(/[\r\n\s]/g, ""));
  const asn1 = forge.asn1.fromDer(sigDer);
  const p7 = forge.pkcs7.messageFromAsn1(asn1) as unknown as {
    rawCapture: {
      signature: string;
      authenticatedAttributes: forge.asn1.Asn1[];
      digestAlgorithm: string;
    };
  };
  const raw = p7.rawCapture;
  if (!raw?.signature || !raw?.authenticatedAttributes) {
    throw new Error("PKCS#7-Struktur unvollständig (keine signierten Attribute)");
  }

  // 1) digest algorithm must be SHA-256
  const digestOid = forge.asn1.derToOid(raw.digestAlgorithm);
  if (digestOid !== forge.pki.oids.sha256) {
    throw new Error(`Nicht unterstützter Digest (${digestOid}) — erwartet SHA-256`);
  }

  // 2) messageDigest attribute must equal sha256(canonical content)
  const contentHash = crypto.createHash("sha256").update(Buffer.from(canonical, "binary")).digest();
  let attrDigestOk = false;
  for (const attr of raw.authenticatedAttributes) {
    const attrValue = attr.value as forge.asn1.Asn1[];
    const oid = forge.asn1.derToOid((attrValue[0] as { value: string }).value as string);
    if (oid === forge.pki.oids.messageDigest) {
      const digestAsn = (attrValue[1] as { value: forge.asn1.Asn1[] }).value[0] as { value: string };
      const attrDigest = Buffer.from(digestAsn.value as string, "binary");
      attrDigestOk = attrDigest.equals(contentHash);
    }
  }
  if (!attrDigestOk) throw new Error("Inhalt verändert — messageDigest stimmt nicht überein");

  // 3) RSA signature over DER(SET of authenticatedAttributes) with the pinned cert
  const set = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SET,
    true,
    raw.authenticatedAttributes,
  );
  const setDigest = crypto
    .createHash("sha256")
    .update(Buffer.from(forge.asn1.toDer(set).getBytes(), "binary"))
    .digest("binary" as crypto.BinaryToTextEncoding);
  const pinned = forge.pki.certificateFromPem(pinnedCertificatePem);
  const pub = pinned.publicKey as forge.pki.rsa.PublicKey;
  let sigOk = false;
  try {
    sigOk = pub.verify(setDigest as unknown as string, raw.signature);
  } catch {
    sigOk = false;
  }
  if (!sigOk) throw new Error("Signaturprüfung fehlgeschlagen (Zertifikat passt nicht)");

  return {
    payload: forge.util.decodeUtf8(contentPart.body),
    payloadContentType: contentPart.headers["content-type"] ?? "application/octet-stream",
    micBase64: computeMic(canonical),
  };
}

/* ------------------------------------------------------------------ */
/* encryption (application/pkcs7-mime, enveloped-data)                 */
/* ------------------------------------------------------------------ */

export function encryptMime(
  innerBody: string,
  innerContentType: string,
  recipientCertificatePem: string,
): { body: string; contentType: string } {
  const mime =
    `Content-Type: ${innerContentType}` + CRLF + CRLF +
    innerBody;
  const p7 = forge.pkcs7.createEnvelopedData();
  p7.addRecipient(forge.pki.certificateFromPem(recipientCertificatePem));
  p7.content = forge.util.createBuffer(mime, "binary" as forge.Encoding);
  p7.encrypt(undefined, forge.pki.oids["aes256-CBC"]);
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return {
    body: chunkBase64(forge.util.encode64(der)),
    contentType: 'application/pkcs7-mime; smime-type=enveloped-data; name="smime.p7m"',
  };
}

export function decryptMime(
  base64Body: string,
  identity: { privateKeyPem: string; certificatePem: string },
): { body: string; contentType: string } {
  const der = forge.util.decode64(base64Body.replace(/[\r\n\s]/g, ""));
  const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(der)) as forge.pkcs7.PkcsEnvelopedData;
  const cert = forge.pki.certificateFromPem(identity.certificatePem);
  const recipient = p7.findRecipient(cert);
  if (!recipient) throw new Error("Nachricht ist nicht an dieses Zertifikat verschlüsselt");
  p7.decrypt(recipient, forge.pki.privateKeyFromPem(identity.privateKeyPem));
  const rawContent = p7.content;
  const mime = typeof rawContent === "string" ? rawContent : (rawContent?.getBytes() ?? "");
  const sep = mime.indexOf(`${CRLF}${CRLF}`);
  if (sep === -1) throw new Error("Entschlüsselter Inhalt ist kein MIME");
  const headerBlock = mime.slice(0, sep);
  const ctLine = headerBlock
    .split(/\r?\n/)
    .find((l: string) => l.toLowerCase().startsWith("content-type:"));
  return {
    body: mime.slice(sep + 4),
    contentType: ctLine ? ctLine.slice(ctLine.indexOf(":") + 1).trim() : "application/octet-stream",
  };
}

/* ------------------------------------------------------------------ */
/* MDN                                                                 */
/* ------------------------------------------------------------------ */

export type MdnDisposition =
  | { processed: true; warning?: string }
  | { processed: false; error: string };

/** Build a SIGNED synchronous MDN (multipart/report inside multipart/signed). */
export function buildSignedMdn(args: {
  originalMessageId: string;
  as2From: string; // us
  as2To: string;   // partner
  micBase64: string | null;
  disposition: MdnDisposition;
  signer: { privateKeyPem: string; certificatePem: string };
}): { body: string; contentType: string } {
  const dispositionLine = args.disposition.processed
    ? args.disposition.warning
      ? `automatic-action/MDN-sent-automatically; processed/warning: ${args.disposition.warning.replace(/[\r\n]/g, " ").slice(0, 200)}`
      : "automatic-action/MDN-sent-automatically; processed"
    : `automatic-action/MDN-sent-automatically; processed/error: ${args.disposition.error.replace(/[\r\n]/g, " ").slice(0, 200)}`;

  const humanText = args.disposition.processed
    ? args.disposition.warning
      ? `Die AS2-Nachricht wurde angenommen (Hinweis): ${args.disposition.warning}`
      : "Die AS2-Nachricht wurde empfangen und verarbeitet."
    : `Die AS2-Nachricht konnte nicht verarbeitet werden: ${args.disposition.error}`;

  const fields = [
    `Reporting-UA: DocklyLogistics AS2`,
    `Original-Recipient: rfc822; ${args.as2From}`,
    `Final-Recipient: rfc822; ${args.as2From}`,
    `Original-Message-ID: ${args.originalMessageId}`,
    `Disposition: ${dispositionLine}`,
    ...(args.micBase64 ? [`Received-Content-MIC: ${args.micBase64}, sha256`] : []),
  ].join(CRLF);

  const boundary = newBoundary("report");
  const report =
    `--${boundary}` + CRLF +
    `Content-Type: text/plain; charset=utf-8` + CRLF + CRLF +
    forge.util.encodeUtf8(humanText) + CRLF +
    `--${boundary}` + CRLF +
    `Content-Type: message/disposition-notification` + CRLF + CRLF +
    fields + CRLF +
    `--${boundary}--`;

  const signed = signPayload(
    // sign the whole report as payload of the signed container
    report,
    `multipart/report; report-type=disposition-notification; boundary="${boundary}"`,
    args.signer,
  );
  return { body: signed.body, contentType: signed.contentType };
}

export type ParsedMdn = {
  disposition: string;
  processed: boolean;
  micBase64: string | null;
  originalMessageId: string | null;
};

/** Parse (and, when signed + cert given, verify) an MDN response body. */
export function parseMdn(
  body: string,
  contentTypeHeader: string,
  pinnedCertificatePem?: string | null,
): ParsedMdn {
  let reportBody = body;
  let reportCt = contentTypeHeader;

  if (/multipart\/signed/i.test(contentTypeHeader)) {
    if (pinnedCertificatePem) {
      const v = verifySignedMime(body, contentTypeHeader, pinnedCertificatePem);
      reportBody = v.payload;
      reportCt = v.payloadContentType;
    } else {
      // unsigned verification not possible — extract first part
      const boundary = headerParam(contentTypeHeader, "boundary");
      const parts = boundary ? splitMultipart(body, boundary) : [];
      reportBody = parts[0]?.body ?? body;
      reportCt = parts[0]?.headers["content-type"] ?? contentTypeHeader;
    }
  }

  const boundary = headerParam(reportCt, "boundary");
  if (!boundary) throw new Error("MDN ohne multipart/report-Boundary");
  const parts = splitMultipart(reportBody, boundary);
  const dispPart = parts.find((p) =>
    (p.headers["content-type"] ?? "").includes("disposition-notification"),
  );
  if (!dispPart) throw new Error("MDN ohne disposition-notification-Part");

  const get = (name: string): string | null => {
    const line = dispPart.body
      .split(/\r?\n/)
      .find((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}:`));
    return line ? line.slice(line.indexOf(":") + 1).trim() : null;
  };
  const disposition = get("Disposition") ?? "";
  const mic = get("Received-Content-MIC");
  // "processed" and "processed/warning" are success; "processed/error" and
  // "failed" are not. (A duplicate is a warning → still counts as delivered.)
  const isError = /processed\/(error|failure)/i.test(disposition) || /;\s*failed/i.test(disposition);
  return {
    disposition,
    processed: !isError && /processed/i.test(disposition),
    micBase64: mic ? (mic.split(",")[0] ?? "").trim() : null,
    originalMessageId: get("Original-Message-ID"),
  };
}
