import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { purgeAppendOnly } from "../helpers/purge-append-only";
import { makeRequest, sessionHeaders, readJson } from "./helpers";

// Der Akteur im Audit kommt aus der Sitzung (nicht aus den x-user-Headern).
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { email: "admin@x.de", id: "admin-1" } })),
}));

import { PUT, DELETE } from "@/app/api/v1/me/tenant-view/route";

const HOME = "test-int-tv-home";
const TARGET = "test-int-tv-target";
const URL_ = "http://localhost/api/v1/me/tenant-view";
const COOKIE = "admin_view_tenant";

async function cleanup() {
  await purgeAppendOnly(prisma, { tenantIds: [HOME, TARGET] });
  await prisma.tenant.deleteMany({ where: { id: { in: [HOME, TARGET] } } });
}

const viewAudit = (tenantId: string) =>
  prisma.auditLog.findMany({ where: { tenantId, entity: "AdminTenantView" }, orderBy: { createdAt: "asc" } });

describe("/api/v1/me/tenant-view", () => {
  beforeAll(async () => {
    await cleanup();
    for (const id of [HOME, TARGET]) {
      await prisma.tenant.create({ data: { id, name: id } });
    }
  });
  afterAll(cleanup);

  describe("PUT", () => {
    it("MANAGER bekommt 403 und es wird kein Cookie gesetzt", async () => {
      const res = await PUT(
        makeRequest(URL_, { method: "PUT", headers: await sessionHeaders("MANAGER", HOME), body: { tenantId: TARGET } }),
      );
      expect(res.status).toBe(403);
      expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("ohne Anmeldung → 401, kein Cookie", async () => {
      const res = await PUT(makeRequest(URL_, { method: "PUT", body: { tenantId: TARGET } }));
      expect(res.status).toBe(401);
      expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("unbekannter Mandant → 404 und kein Set-Cookie", async () => {
      const res = await PUT(
        makeRequest(URL_, {
          method: "PUT",
          headers: await sessionHeaders("GLOBAL_ADMIN", HOME),
          body: { tenantId: "gibt-es-nicht" },
        }),
      );
      expect(res.status).toBe(404);
      expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("ungültiger Body → 422, kein Cookie", async () => {
      const res = await PUT(
        makeRequest(URL_, { method: "PUT", headers: await sessionHeaders("GLOBAL_ADMIN", HOME), body: {} }),
      );
      expect(res.status).toBe(422);
      expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("gültig → 200, Session-Cookie (httpOnly, lax, Pfad /, ohne Laufzeit) und Audit im ZIEL-Mandanten", async () => {
      const res = await PUT(
        makeRequest(URL_, {
          method: "PUT",
          headers: await sessionHeaders("GLOBAL_ADMIN", HOME),
          body: { tenantId: TARGET },
        }),
      );
      expect(res.status).toBe(200);
      const body = await readJson<{ data: { tenant: { id: string; name: string } } }>(res);
      expect(body.data.tenant).toEqual({ id: TARGET, name: TARGET });

      const cookie = res.headers.get("set-cookie") ?? "";
      expect(cookie).toContain(`${COOKIE}=${TARGET}`);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=lax/i);
      expect(cookie).toMatch(/Path=\//i);
      expect(cookie).not.toMatch(/Max-Age|Expires/i); // Session-Cookie

      const rows = await viewAudit(TARGET);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        entity: "AdminTenantView",
        entityId: TARGET,
        action: "UPDATE",
        actorId: "admin-1",
        actorEmail: "admin@x.de",
      });
      expect(rows[0].after).toEqual({ viewingAs: TARGET });
      expect(await viewAudit(HOME)).toHaveLength(0); // nicht im eigenen Mandanten
    });
  });

  describe("DELETE", () => {
    it("MANAGER bekommt 403", async () => {
      const res = await DELETE(
        makeRequest(URL_, { method: "DELETE", headers: { ...(await sessionHeaders("MANAGER", HOME)), cookie: `${COOKIE}=${TARGET}` } }),
      );
      expect(res.status).toBe(403);
      expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("löscht das Cookie und auditiert im bisher betrachteten Mandanten", async () => {
      const before = (await viewAudit(TARGET)).length;
      const res = await DELETE(
        makeRequest(URL_, {
          method: "DELETE",
          headers: { ...(await sessionHeaders("GLOBAL_ADMIN", TARGET)), cookie: `${COOKIE}=${TARGET}` },
        }),
      );
      expect(res.status).toBe(204);
      const cookie = res.headers.get("set-cookie") ?? "";
      expect(cookie).toMatch(new RegExp(`${COOKIE}=;`));
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);

      const rows = await viewAudit(TARGET);
      expect(rows).toHaveLength(before + 1);
      expect(rows[rows.length - 1]).toMatchObject({ action: "DELETE", actorId: "admin-1", before: { viewingAs: TARGET } });
    });

    it("ohne gesetztes Cookie: 204, Cookie wird trotzdem gelöscht, kein Audit", async () => {
      const before = (await viewAudit(TARGET)).length;
      const res = await DELETE(
        makeRequest(URL_, { method: "DELETE", headers: await sessionHeaders("GLOBAL_ADMIN", HOME) }),
      );
      expect(res.status).toBe(204);
      expect(res.headers.get("set-cookie")).toMatch(new RegExp(`${COOKIE}=;`));
      expect(await viewAudit(TARGET)).toHaveLength(before);
    });

    it("manipuliertes Cookie mit unbekanntem Mandanten erzeugt keinen Audit-Eintrag", async () => {
      const res = await DELETE(
        makeRequest(URL_, {
          method: "DELETE",
          headers: { ...(await sessionHeaders("GLOBAL_ADMIN", HOME)), cookie: `${COOKIE}=gibt-es-nicht` },
        }),
      );
      expect(res.status).toBe(204);
      expect(await prisma.auditLog.count({ where: { tenantId: "gibt-es-nicht" } })).toBe(0);
    });
  });
});
