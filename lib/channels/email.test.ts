import { describe, it, expect, vi, beforeEach } from "vitest";
import { Buffer } from "node:buffer";

vi.mock("./scaleway-mail", () => ({
  getScalewayTemConfig: vi.fn(),
  sendViaScalewayTem: vi.fn(),
  isRetryableTemError: vi.fn(() => false),
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: vi.fn(async () => ({})) })) },
}));
vi.mock("node:fs/promises", () => ({
  default: { mkdir: vi.fn(async () => {}), writeFile: vi.fn(async () => {}) },
}));

import { dispatchEmail, sendTestEmail } from "./email";
import { getScalewayTemConfig, sendViaScalewayTem } from "./scaleway-mail";
import nodemailer from "nodemailer";
import type { DispatchInput } from "./types";

const mockTem = vi.mocked(getScalewayTemConfig);
const mockSend = vi.mocked(sendViaScalewayTem);

function makeInput(
  tenantConfig: Record<string, unknown>,
  supplier: Record<string, unknown> = { email: "sup@x.de", channelConfig: {} },
): DispatchInput {
  return {
    order: { orderNo: "ORD-2026-0001", notes: null, supplier },
    tenantCfg: { config: tenantConfig },
    pdfBuffer: Buffer.from("PDF"),
  } as unknown as DispatchInput;
}

beforeEach(() => vi.clearAllMocks());

describe("dispatchEmail — provider cascade", () => {
  it("prefers Scaleway TEM when configured", async () => {
    mockTem.mockReturnValue({ secretKey: "k", projectId: "p", region: "fr-par" });
    mockSend.mockResolvedValue({ messageId: "msg-1" });
    const r = await dispatchEmail(makeInput({ fromEmail: "from@x.de", fromName: "S" }));
    expect(r.ok).toBe(true);
    expect(mockSend).toHaveBeenCalledOnce();
    expect(r.details?.provider).toBe("scaleway-tem");
  });

  it("falls back to SMTP when TEM is not configured", async () => {
    mockTem.mockReturnValue(null);
    const r = await dispatchEmail(
      makeInput({ fromEmail: "from@x.de", fromName: "S", smtp: { host: "h", port: 587, user: "u", pass: "p" } }),
    );
    expect(r.ok).toBe(true);
    expect(r.message).toContain("SMTP");
    expect(nodemailer.createTransport).toHaveBeenCalledOnce();
  });

  it("falls back to the local mock when no provider is configured", async () => {
    mockTem.mockReturnValue(null);
    const r = await dispatchEmail(makeInput({ fromEmail: "from@x.de", fromName: "S" }));
    expect(r.ok).toBe(true);
    expect(r.message).toContain("Mock-Mail");
  });

  it("fails when the recipient is missing", async () => {
    mockTem.mockReturnValue(null);
    const r = await dispatchEmail(makeInput({ fromEmail: "from@x.de", fromName: "S" }, { email: null, channelConfig: {} }));
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Empfänger");
  });

  it("fails when the sender is missing", async () => {
    mockTem.mockReturnValue(null);
    const r = await dispatchEmail(makeInput({ fromName: "S" }));
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Absender");
  });
});

describe("sendTestEmail", () => {
  it("uses TEM when configured", async () => {
    mockTem.mockReturnValue({ secretKey: "k", projectId: "p", region: "fr-par" });
    mockSend.mockResolvedValue({ messageId: "t-1" });
    const r = await sendTestEmail({ fromEmail: "from@x.de", fromName: "S" }, "to@x.de");
    expect(r.ok).toBe(true);
    expect(r.details?.provider).toBe("scaleway-tem");
  });

  it("reports no provider when neither TEM nor SMTP is set", async () => {
    mockTem.mockReturnValue(null);
    const r = await sendTestEmail({ fromEmail: "from@x.de", fromName: "S" });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Kein Mail-Provider");
  });
});
