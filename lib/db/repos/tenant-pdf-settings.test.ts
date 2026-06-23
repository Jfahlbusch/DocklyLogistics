import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { tenantPdfSettingsRepo } from "./tenant-pdf-settings";

const T = "test-pdfsettings";

describe("tenantPdfSettingsRepo", () => {
  beforeAll(async () => {
    await prisma.tenantPdfSettings.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.upsert({ where: { id: T }, update: {}, create: { id: T, name: T } });
  });
  afterAll(async () => {
    await prisma.tenantPdfSettings.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.deleteMany({ where: { id: T } });
  });

  it("returns empty defaults when unset", async () => {
    expect(await tenantPdfSettingsRepo.get(T)).toEqual({ logoDataUri: null, headerText: null, footerText: null });
  });

  it("upserts, reads back, and updates", async () => {
    await tenantPdfSettingsRepo.upsert(T, { logoDataUri: "data:image/png;base64,AAA", headerText: "Kopf", footerText: "Fuß" });
    expect(await tenantPdfSettingsRepo.get(T)).toEqual({
      logoDataUri: "data:image/png;base64,AAA",
      headerText: "Kopf",
      footerText: "Fuß",
    });

    await tenantPdfSettingsRepo.upsert(T, { logoDataUri: null, headerText: "Neu", footerText: null });
    expect(await tenantPdfSettingsRepo.get(T)).toEqual({ logoDataUri: null, headerText: "Neu", footerText: null });
  });
});
