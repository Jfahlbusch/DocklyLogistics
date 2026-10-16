import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";

// Cookie-Store und NextAuth ersetzen — geprüft wird die Logik der Routen.
const { store, signIn, state } = vi.hoisted(() => ({
  store: { set: vi.fn(), delete: vi.fn() },
  signIn: vi.fn(async () => new Response(null, { status: 302 })),
  state: { session: null as Record<string, unknown> | null },
}));

vi.mock("next/headers", () => ({ cookies: async () => store }));
vi.mock("@/lib/auth", () => ({ signIn, auth: vi.fn(async () => state.session) }));

import { GET as sso } from "@/app/users/auth/sso/route";
import { GET as complete } from "@/app/users/auth/complete/route";

const HOME = "test-int-flow-home";
const VIEWED = "test-int-flow-viewed";

afterEach(() => vi.clearAllMocks());

describe("SSO-Einstieg /users/auth/sso", () => {
  it("mit origin: beendet eine Mandanten-Ansicht und merkt den Ziel-Mandanten", async () => {
    await sso(new NextRequest("http://localhost/users/auth/sso?origin=daube"));
    expect(store.delete).toHaveBeenCalledWith("admin_view_tenant");
    expect(store.set).toHaveBeenCalledWith("dl_tenant", "daube", expect.objectContaining({ httpOnly: true }));
    expect(signIn).toHaveBeenCalledOnce();
  });

  it("ohne origin: Ansicht bleibt unberührt", async () => {
    await sso(new NextRequest("http://localhost/users/auth/sso"));
    expect(store.delete).not.toHaveBeenCalled();
    expect(signIn).toHaveBeenCalledOnce();
  });
});

describe("Login-Abschluss /users/auth/complete", () => {
  beforeAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: [HOME, VIEWED] } } });
  });
  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: [HOME, VIEWED] } } });
  });

  it("legt immer den HEIM-Mandanten an, nie den betrachteten", async () => {
    state.session = { role: "GLOBAL_ADMIN", tenant: VIEWED, homeTenant: HOME };
    const res = await complete();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/dashboard");
    expect(await prisma.tenant.findUnique({ where: { id: HOME } })).not.toBeNull();
    expect(await prisma.tenant.findUnique({ where: { id: VIEWED } })).toBeNull();
  });

  it("ohne Rolle → zurück zum Login, nichts angelegt", async () => {
    state.session = { tenant: VIEWED, homeTenant: VIEWED };
    const res = await complete();
    expect(res.headers.get("location")).toBe("/login?error=unauthorized");
    expect(await prisma.tenant.findUnique({ where: { id: VIEWED } })).toBeNull();
  });
});
