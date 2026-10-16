import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { generateApiKey } from "@/lib/services/api-key";
import { userApiKeyRepo } from "@/lib/db/repos/user-api-key";
import { notificationRepo } from "@/lib/db/repos/notification";
import { buildOpenApi } from "@/lib/api/openapi";
import { makeRequest, sessionHeaders, readJson } from "./helpers";

// Der Lesestatus hängt an der E-Mail aus der Sitzung; der Test steuert sie je Aufruf.
let sessionEmail: string | null = "alice@example.com";
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => (sessionEmail ? { user: { email: sessionEmail } } : null)),
}));

import { GET } from "@/app/api/v1/me/notifications/route";
import { POST } from "@/app/api/v1/me/notifications/read/route";
import "@/lib/schemas/notification";

const SUFFIX = randomBytes(4).toString("hex");
const T = `test-int-notif-${SUFFIX}`;
const OTHER = `test-int-notif-other-${SUFFIX}`;
const LIST_URL = "http://localhost/api/v1/me/notifications";
const READ_URL = "http://localhost/api/v1/me/notifications/read";

type ListBody = {
  data: {
    items: Array<{
      id: string;
      type: string;
      title: string;
      body: string | null;
      link: string | null;
      readAt: string | null;
      createdAt: string;
    }>;
    unread: number;
  };
};

async function list(email = "alice@example.com", role = "VIEWER", tenant = T): Promise<ListBody> {
  sessionEmail = email;
  const res = await GET(makeRequest(LIST_URL, { headers: await sessionHeaders(role, tenant) }));
  expect(res.status).toBe(200);
  return readJson<ListBody>(res);
}

async function read(body: unknown, email = "alice@example.com", role = "VIEWER", tenant = T) {
  sessionEmail = email;
  return POST(
    makeRequest(READ_URL, { method: "POST", headers: await sessionHeaders(role, tenant), body }),
  );
}

async function wipe() {
  await prisma.userApiKey.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.notification.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [T, OTHER] } } });
}

describe("/api/v1/me/notifications", () => {
  let n1: string;
  let n2: string;
  let foreign: string;

  beforeAll(async () => {
    await wipe();
    for (const id of [T, OTHER]) {
      await prisma.tenant.upsert({ where: { id }, update: {}, create: { id, name: id } });
    }
  });
  afterAll(wipe);

  beforeEach(async () => {
    await prisma.notification.deleteMany({ where: { tenantId: { in: [T, OTHER] } } });
    n1 = (await notificationRepo.create({ tenantId: T, type: "import", title: "Eins", link: "/import?batch=1" })).id;
    await new Promise((r) => setTimeout(r, 5));
    n2 = (await notificationRepo.create({ tenantId: T, type: "import", title: "Zwei" })).id;
    foreign = (await notificationRepo.create({ tenantId: OTHER, type: "import", title: "Fremd" })).id;
  });

  it("401 ohne Sitzung (GET und POST)", async () => {
    expect((await GET(makeRequest(LIST_URL))).status).toBe(401);
    expect((await POST(makeRequest(READ_URL, { method: "POST", body: {} }))).status).toBe(401);
  });

  it("401, wenn die Sitzung keine E-Mail liefert", async () => {
    sessionEmail = null;
    const res = await GET(makeRequest(LIST_URL, { headers: await sessionHeaders("VIEWER", T) }));
    expect(res.status).toBe(401);
  });

  it("ein VIEWER darf lesen: neueste zuerst, nur der eigene Mandant, mit link und Zähler", async () => {
    const b = await list("alice@example.com", "VIEWER");
    expect(b.data.items.map((i) => i.title)).toEqual(["Zwei", "Eins"]);
    expect(b.data.unread).toBe(2);
    expect(b.data.items.find((i) => i.id === n1)?.link).toBe("/import?batch=1");
    expect(b.data.items.some((i) => i.id === foreign)).toBe(false);
  });

  it("ein VIEWER darf quittieren; der Lesestatus gilt nur für ihn", async () => {
    const res = await read({ id: n1 }, "alice@example.com", "VIEWER");
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ data: { ok: true } });

    const forAlice = await list("alice@example.com");
    expect(forAlice.data.unread).toBe(1);
    expect(forAlice.data.items.find((i) => i.id === n1)?.readAt).not.toBeNull();

    const forBob = await list("bob@example.com");
    expect(forBob.data.unread).toBe(2);
    expect(forBob.data.items.find((i) => i.id === n1)?.readAt).toBeNull();
  });

  it("quittieren ist idempotent", async () => {
    expect((await read({ id: n1 })).status).toBe(200);
    expect((await read({ id: n1 })).status).toBe(200);
    expect((await list()).data.unread).toBe(1);
  });

  it("ohne id werden alle für den Nutzer quittiert (auch ohne Body)", async () => {
    expect((await read({})).status).toBe(200);
    expect((await list("alice@example.com")).data.unread).toBe(0);
    expect((await list("bob@example.com")).data.unread).toBe(2);

    sessionEmail = "bob@example.com";
    const res = await POST(
      makeRequest(READ_URL, { method: "POST", headers: await sessionHeaders("VIEWER", T) }),
    );
    expect(res.status).toBe(200);
    expect((await list("bob@example.com")).data.unread).toBe(0);
  });

  it("der Mandant kommt nie aus dem Body: fremde IDs und tenantId im Body bleiben wirkungslos", async () => {
    const res = await read({ id: foreign, tenantId: OTHER });
    expect(res.status).toBe(200); // fremde ID wird ignoriert, kein Fehler (kein Orakel)
    expect(await prisma.notificationRead.count({ where: { notificationId: foreign } })).toBe(0);

    // Sammelquittung mit tenantId im Body trifft ebenfalls nur den eigenen Mandanten.
    await read({ tenantId: OTHER });
    expect(await prisma.notificationRead.count({ where: { notificationId: foreign } })).toBe(0);
    expect(await notificationRepo.unreadCount(OTHER, "alice@example.com")).toBe(1);
    expect((await list()).data.unread).toBe(0);
  });

  it("422 bei ungültigem Body", async () => {
    expect((await read({ id: 42 })).status).toBe(422);
  });

  it("persönlicher API-Key: E-Mail und Mandant kommen aus dem Key (Kleinschreibung egal)", async () => {
    const k = generateApiKey();
    await userApiKeyRepo.create({
      tenantId: T,
      userId: "u1",
      userEmail: "Carol@Example.com",
      label: "t",
      prefix: k.prefix,
      hash: k.hash,
      role: "VIEWER",
    });
    sessionEmail = null; // beweist: die Sitzung wird auf dem Key-Pfad nicht gebraucht
    const headers = { "x-api-key": k.fullKey };

    const before = await GET(makeRequest(LIST_URL, { headers }));
    expect(before.status).toBe(200);
    expect((await readJson<ListBody>(before)).data.unread).toBe(2);

    const mark = await POST(makeRequest(READ_URL, { method: "POST", headers, body: { id: n2 } }));
    expect(mark.status).toBe(200);

    const after = await readJson<ListBody>(await GET(makeRequest(LIST_URL, { headers })));
    expect(after.data.unread).toBe(1);
    // Dieselbe Person ist über die Sitzung mit gleicher Adresse dieselbe Person.
    expect(await notificationRepo.unreadCount(T, "carol@example.com")).toBe(1);
    expect(await notificationRepo.unreadCount(T, "alice@example.com")).toBe(2);
  });

  describe("OpenAPI", () => {
    type Schema = { $ref?: string; properties?: Record<string, Schema>; items?: Schema };
    type Doc = {
      components: { schemas: Record<string, Schema> };
      paths: Record<
        string,
        Record<string, { responses: Record<string, { content?: Record<string, { schema: Schema }> }> }>
      >;
    };
    /** Benannte Zod-Schemas erscheinen im Dokument als $ref auf components.schemas. */
    const resolve = (doc: Doc, s: Schema): Schema =>
      s.$ref ? doc.components.schemas[s.$ref.split("/").pop() as string] : s;

    it("beschreibt die Antwort mit genau den Feldern, die die Route liefert (inkl. link)", async () => {
      const doc = buildOpenApi() as unknown as Doc;
      const root = resolve(doc, doc.paths["/me/notifications"].get.responses["200"].content!["application/json"].schema);
      const data = resolve(doc, root.properties!.data);
      const item = resolve(doc, data.properties!.items.items!);

      const real = (await list()).data.items[0];
      expect(Object.keys(item.properties ?? {}).sort()).toEqual(Object.keys(real).sort());
      expect(item.properties).toHaveProperty("link");
      expect(Object.keys(data.properties ?? {}).sort()).toEqual(["items", "unread"]);
    });

    it("dokumentiert das Quittieren mit Body-Schema und 401/422", () => {
      const doc = buildOpenApi() as unknown as Doc;
      const op = doc.paths["/me/notifications/read"].post;
      expect(Object.keys(op.responses)).toEqual(expect.arrayContaining(["200", "401", "422"]));
    });
  });
});
