import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { generateApiKey } from "@/lib/services/api-key";
import { userApiKeyRepo } from "./user-api-key";

const T = "test-uak-repo";
const mk = (userId: string, userEmail: string, label: string) => {
  const g = generateApiKey();
  return userApiKeyRepo.create({ tenantId: T, userId, userEmail, label, prefix: g.prefix, hash: g.hash, role: "USER" });
};

describe("userApiKeyRepo", () => {
  beforeAll(async () => {
    await prisma.tenant.upsert({ where: { id: T }, update: {}, create: { id: T, name: T } });
  });
  afterAll(async () => {
    await prisma.userApiKey.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.deleteMany({ where: { id: T } });
  });

  it("lists only the user's own non-revoked keys", async () => {
    await mk("ua", "ua@x.de", "a");
    const revoked = await mk("ua", "ua@x.de", "b");
    await userApiKeyRepo.revoke(T, "ua", revoked.id);
    await mk("ub", "ub@x.de", "other-user");

    const list = await userApiKeyRepo.listForUser(T, "ua");
    expect(list.length).toBe(1);
    expect(list[0].label).toBe("a");
  });

  it("revoke is tenant + user scoped", async () => {
    const k = await mk("uc", "uc@x.de", "c");
    expect((await userApiKeyRepo.revoke(T, "wrong-user", k.id)).count).toBe(0);
    expect((await userApiKeyRepo.revoke("wrong-tenant", "uc", k.id)).count).toBe(0);
    expect((await userApiKeyRepo.revoke(T, "uc", k.id)).count).toBe(1);
  });
});
