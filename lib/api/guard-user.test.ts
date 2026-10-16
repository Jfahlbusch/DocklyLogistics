import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { generateApiKey } from "@/lib/services/api-key";
import { userApiKeyRepo } from "@/lib/db/repos/user-api-key";
import { signUserHeaders } from "./user-headers";

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));

import { requireUserFromHeaders, ForbiddenError, UnauthenticatedError } from "./guard";

const T = `test-guard-user-${randomBytes(4).toString("hex")}`;

async function session(role: string, tenant: string): Promise<Headers> {
  return new Headers({
    "x-user-role": role,
    "x-user-tenant": tenant,
    "x-user-signature": await signUserHeaders(role, tenant),
  });
}

describe("requireUserFromHeaders", () => {
  let key = "";

  beforeAll(async () => {
    await prisma.tenant.upsert({ where: { id: T }, update: {}, create: { id: T, name: T } });
    const k = generateApiKey();
    await userApiKeyRepo.create({
      tenantId: T,
      userId: "u1",
      userEmail: "Key.User@Example.com",
      label: "t",
      prefix: k.prefix,
      hash: k.hash,
      role: "VIEWER",
    });
    key = k.fullKey;
  });
  afterAll(async () => {
    await prisma.userApiKey.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.deleteMany({ where: { id: T } });
  });
  beforeEach(() => authMock.mockReset());

  it("Sitzung: liefert Rolle, Mandant (aus dem signierten Header) und die normalisierte E-Mail", async () => {
    authMock.mockResolvedValue({ user: { email: "  Alice@Example.COM " } });
    const ctx = await requireUserFromHeaders(await session("VIEWER", T), "VIEWER");
    expect(ctx).toEqual({ role: "VIEWER", tenantId: T, userEmail: "alice@example.com" });
  });

  it("Sitzung ohne E-Mail: 401", async () => {
    authMock.mockResolvedValue({ user: {} });
    await expect(requireUserFromHeaders(await session("VIEWER", T), "VIEWER")).rejects.toThrow(
      UnauthenticatedError,
    );
  });

  it("Sitzung: Rolle unter Mindestrolle: 403 (E-Mail wird gar nicht erst gelesen)", async () => {
    await expect(requireUserFromHeaders(await session("VIEWER", T), "MANAGER")).rejects.toThrow(
      ForbiddenError,
    );
    expect(authMock).not.toHaveBeenCalled();
  });

  it("ohne Sitzung und ohne Key: 401", async () => {
    await expect(requireUserFromHeaders(new Headers(), "VIEWER")).rejects.toThrow(UnauthenticatedError);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("SICHERHEIT: gefälschte Header zählen nicht, auch wenn auth() eine E-Mail liefern würde", async () => {
    authMock.mockResolvedValue({ user: { email: "x@example.com" } });
    const h = new Headers({ "x-user-role": "GLOBAL_ADMIN", "x-user-tenant": T });
    await expect(requireUserFromHeaders(h, "VIEWER")).rejects.toThrow(UnauthenticatedError);
  });

  it("persönlicher API-Key: E-Mail und Mandant kommen aus dem Key, nicht aus auth()", async () => {
    const ctx = await requireUserFromHeaders(new Headers({ "x-api-key": key }), "VIEWER");
    expect(ctx).toEqual({ role: "VIEWER", tenantId: T, userEmail: "key.user@example.com" });
    expect(authMock).not.toHaveBeenCalled();
  });

  it("persönlicher API-Key: Rolle unter Mindestrolle: 403", async () => {
    await expect(requireUserFromHeaders(new Headers({ "x-api-key": key }), "USER")).rejects.toThrow(
      ForbiddenError,
    );
  });
});
