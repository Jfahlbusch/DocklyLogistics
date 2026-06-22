import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { generateApiKey } from "@/lib/services/api-key";
import { userApiKeyRepo } from "@/lib/db/repos/user-api-key";
import { resolveUserApiKey } from "./user-key-auth";

const TENANT = "test-user-key";
const hdr = (key: string) => new Headers({ "x-api-key": key });

describe("resolveUserApiKey", () => {
  let validKey = "";
  let revokedKey = "";
  let expiredKey = "";

  beforeAll(async () => {
    await prisma.tenant.upsert({ where: { id: TENANT }, update: {}, create: { id: TENANT, name: TENANT } });

    const v = generateApiKey();
    await userApiKeyRepo.create({ tenantId: TENANT, userId: "u1", userEmail: "u1@x.de", label: "v", prefix: v.prefix, hash: v.hash, role: "MANAGER" });
    validKey = v.fullKey;

    const r = generateApiKey();
    const rk = await userApiKeyRepo.create({ tenantId: TENANT, userId: "u1", userEmail: "u1@x.de", label: "r", prefix: r.prefix, hash: r.hash, role: "USER" });
    await prisma.userApiKey.update({ where: { id: rk.id }, data: { revokedAt: new Date() } });
    revokedKey = r.fullKey;

    const e = generateApiKey();
    await userApiKeyRepo.create({ tenantId: TENANT, userId: "u1", userEmail: "u1@x.de", label: "e", prefix: e.prefix, hash: e.hash, role: "USER", expiresAt: new Date(Date.now() - 1000) });
    expiredKey = e.fullKey;
  });

  afterAll(async () => {
    await prisma.userApiKey.deleteMany({ where: { tenantId: TENANT } });
    await prisma.tenant.deleteMany({ where: { id: TENANT } });
  });

  it("resolves a valid key to tenant + role", async () => {
    const ctx = await resolveUserApiKey(hdr(validKey));
    expect(ctx).not.toBeNull();
    expect(ctx?.tenantId).toBe(TENANT);
    expect(ctx?.role).toBe("MANAGER");
    expect(ctx?.userId).toBe("u1");
  });

  it("rejects a revoked key", async () => {
    expect(await resolveUserApiKey(hdr(revokedKey))).toBeNull();
  });

  it("rejects an expired key", async () => {
    expect(await resolveUserApiKey(hdr(expiredKey))).toBeNull();
  });

  it("rejects a wrong secret", async () => {
    const prefix = validKey.split(".")[0];
    expect(await resolveUserApiKey(hdr(`${prefix}.WRONGSECRET000000000000000000000000`))).toBeNull();
  });

  it("rejects unknown / malformed", async () => {
    expect(await resolveUserApiKey(hdr("garbage"))).toBeNull();
    expect(await resolveUserApiKey(new Headers())).toBeNull();
  });
});
