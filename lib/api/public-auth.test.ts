import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { authenticatePublic, PublicAuthError } from "./public-auth";
import { generateApiKey } from "@/lib/services/api-key";

const TENANT_ID = "test-public-tenant";
let supplierId = "";
let validKey = ""; // fullKey
let revokedKey = "";

async function cleanup() {
  await prisma.supplierApiKey.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.supplier.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "test-public" } });
  const s = await prisma.supplier.create({
    data: {
      tenantId: TENANT_ID,
      name: "Test Public Sup",
      channel: "EMAIL",
      channelConfig: {},
      active: true,
    },
  });
  supplierId = s.id;

  const gen = generateApiKey();
  validKey = gen.fullKey;
  await prisma.supplierApiKey.create({
    data: {
      tenantId: TENANT_ID,
      supplierId,
      label: "valid",
      prefix: gen.prefix,
      hash: gen.hash,
      scopes: ["orders:read", "orders:confirm"],
      createdBy: "test",
    },
  });

  const gen2 = generateApiKey();
  revokedKey = gen2.fullKey;
  await prisma.supplierApiKey.create({
    data: {
      tenantId: TENANT_ID,
      supplierId,
      label: "revoked",
      prefix: gen2.prefix,
      hash: gen2.hash,
      scopes: ["orders:read"],
      createdBy: "test",
      revokedAt: new Date(),
    },
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

function H(key?: string): Headers {
  const h = new Headers();
  if (key) h.set("x-api-key", key);
  return h;
}

describe("authenticatePublic", () => {
  it("accepts a valid key", async () => {
    const ctx = await authenticatePublic(H(validKey));
    expect(ctx.tenantId).toBe(TENANT_ID);
    expect(ctx.supplierId).toBe(supplierId);
  });

  it("enforces required scope", async () => {
    await expect(authenticatePublic(H(validKey), "deliveries:write")).rejects.toBeInstanceOf(
      PublicAuthError,
    );
  });

  it("rejects missing header", async () => {
    await expect(authenticatePublic(H())).rejects.toBeInstanceOf(PublicAuthError);
  });

  it("rejects revoked key", async () => {
    await expect(authenticatePublic(H(revokedKey))).rejects.toBeInstanceOf(PublicAuthError);
  });

  it("rejects unknown prefix", async () => {
    await expect(
      authenticatePublic(H("dlg_live_nonexistentXXXXX.someSecret")),
    ).rejects.toBeInstanceOf(PublicAuthError);
  });

  it("rejects wrong secret", async () => {
    // Take the valid prefix but use a wrong secret
    const idx = validKey.indexOf(".");
    const wrong = validKey.slice(0, idx) + ".WRONGSECRETwrongsecretWRONGSECRETXX";
    await expect(authenticatePublic(H(wrong))).rejects.toBeInstanceOf(PublicAuthError);
  });
});
