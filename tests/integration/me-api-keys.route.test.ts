import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { makeRequest, sessionHeaders, readJson } from "./helpers";

// Key management resolves the user identity from the session.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "tester@x.de", id: "tester" } })),
}));

import { GET, POST } from "@/app/api/v1/me/api-keys/route";

const T = "test-int-apikeys";
const KEYS_URL = "http://localhost/api/v1/me/api-keys";

describe("/api/v1/me/api-keys", () => {
  beforeAll(async () => {
    await prisma.tenant.upsert({ where: { id: T }, update: {}, create: { id: T, name: T } });
  });
  afterAll(async () => {
    await prisma.userApiKey.deleteMany({ where: { tenantId: T } });
    await prisma.tenant.deleteMany({ where: { id: T } });
  });

  it("rejects an invalid X-API-Key with 401 (guard key path)", async () => {
    const res = await POST(
      makeRequest(KEYS_URL, {
        method: "POST",
        headers: { "x-api-key": "dlg_live_xxx.invalidsecret" },
        body: { label: "x" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("creates a key with the session role and returns it exactly once", async () => {
    const res = await POST(
      makeRequest(KEYS_URL, { method: "POST", headers: sessionHeaders("MANAGER", T), body: { label: "ERP" } }),
    );
    expect(res.status).toBe(201);
    const b = await readJson<{ data: { key: string; role: string; prefix: string } }>(res);
    expect(b.data.role).toBe("MANAGER"); // snapshot of the session role
    expect(b.data.key).toMatch(/^dlg_live_.+\..+/); // full value shown once
    expect(b.data.key.startsWith(b.data.prefix)).toBe(true);
  });

  it("lists the user's keys without exposing the secret", async () => {
    const res = await GET(makeRequest(KEYS_URL, { headers: sessionHeaders("MANAGER", T) }));
    expect(res.status).toBe(200);
    const b = await readJson<{ data: Array<{ key?: string; prefix: string; role: string }> }>(res);
    expect(b.data.length).toBeGreaterThanOrEqual(1);
    expect(b.data[0].key).toBeUndefined();
    expect(b.data[0].role).toBe("MANAGER");
  });
});
