import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { notificationRepo } from "./notification";

// Eindeutiger Suffix: parallele Testläufe auf derselben DB dürfen sich nicht ins Gehege kommen.
const SUFFIX = randomBytes(4).toString("hex");
const T = `test-notif-${SUFFIX}`;
const OTHER = `test-notif-other-${SUFFIX}`;
const A = "a@example.com";
const B = "b@example.com";

/** Alle Testmandanten dieser Datei: Basis, Fremdmandant und die Einzelfall-Mandanten. */
async function wipe() {
  // NotificationRead hängt per Cascade an der Notification.
  await prisma.notification.deleteMany({ where: { tenantId: { contains: SUFFIX } } });
  await prisma.tenant.deleteMany({ where: { id: { contains: SUFFIX } } });
}

async function tenant(suffix: string) {
  const id = `${T}-${suffix}`;
  await prisma.tenant.upsert({ where: { id }, update: {}, create: { id, name: id } });
  return id;
}

describe("notificationRepo", () => {
  beforeAll(async () => {
    await wipe();
    for (const id of [T, OTHER]) {
      await prisma.tenant.upsert({ where: { id }, update: {}, create: { id, name: id } });
    }
  });
  afterAll(wipe);

  describe("Reihenfolge", () => {
    it("liefert neueste zuerst", async () => {
      const t = await tenant("order");
      await notificationRepo.create({ tenantId: t, type: "x", title: "alt" });
      await new Promise((r) => setTimeout(r, 5));
      await notificationRepo.create({ tenantId: t, type: "x", title: "neu" });
      const list = await notificationRepo.listRecent(t, A, 10);
      expect(list.map((n) => n.title)).toEqual(["neu", "alt"]);
    });

    it("ist bei gleichem Zeitstempel deterministisch (id absteigend)", async () => {
      const t = await tenant("tie");
      const createdAt = new Date("2026-10-01T10:00:00.000Z");
      await prisma.notification.createMany({
        data: ["a", "c", "b"].map((k) => ({ id: `${t}-${k}`, tenantId: t, type: "x", title: k, createdAt })),
      });
      const list = await notificationRepo.listRecent(t, A, 10);
      expect(list.map((n) => n.title)).toEqual(["c", "b", "a"]);
    });

    it("begrenzt auf limit", async () => {
      const t = await tenant("limit");
      for (const title of ["1", "2", "3"]) await notificationRepo.create({ tenantId: t, type: "x", title });
      expect(await notificationRepo.listRecent(t, A, 2)).toHaveLength(2);
    });
  });

  describe("Lesestatus je Nutzer", () => {
    it("A liest, B sieht weiter ungelesen", async () => {
      const t = await tenant("peruser");
      const n = await notificationRepo.create({ tenantId: t, type: "x", title: "Hallo", link: "/import" });
      expect(await notificationRepo.unreadCount(t, A)).toBe(1);
      expect(await notificationRepo.unreadCount(t, B)).toBe(1);

      expect(await notificationRepo.markRead(t, A, n.id)).toBe(true);

      expect(await notificationRepo.unreadCount(t, A)).toBe(0);
      expect(await notificationRepo.unreadCount(t, B)).toBe(1);
      const forA = await notificationRepo.listRecent(t, A);
      const forB = await notificationRepo.listRecent(t, B);
      expect(forA[0].readAt).toBeInstanceOf(Date);
      expect(forB[0].readAt).toBeNull();
      // Das Altfeld bleibt unangetastet.
      expect((await prisma.notification.findUnique({ where: { id: n.id } }))?.readAt).toBeNull();
    });

    it("Altbestand: gesetztes Notification.readAt gilt für alle als gelesen", async () => {
      const t = await tenant("legacy");
      const legacy = new Date("2026-09-01T08:00:00.000Z");
      await prisma.notification.create({ data: { tenantId: t, type: "x", title: "alt", readAt: legacy } });
      await notificationRepo.create({ tenantId: t, type: "x", title: "neu" });
      expect(await notificationRepo.unreadCount(t, A)).toBe(1);
      expect(await notificationRepo.unreadCount(t, B)).toBe(1);
      const list = await notificationRepo.listRecent(t, A);
      expect(list.find((n) => n.title === "alt")?.readAt).toEqual(legacy);
      expect(list.find((n) => n.title === "neu")?.readAt).toBeNull();
    });
  });

  describe("Mandantentrennung", () => {
    it("fremder Mandant ist unsichtbar und nicht quittierbar", async () => {
      const foreign = await notificationRepo.create({ tenantId: OTHER, type: "x", title: "fremd" });
      expect(await notificationRepo.listRecent(T, A)).toEqual([]);
      expect(await notificationRepo.unreadCount(T, A)).toBe(0);

      expect(await notificationRepo.markRead(T, A, foreign.id)).toBe(false);
      expect(await prisma.notificationRead.count({ where: { notificationId: foreign.id } })).toBe(0);

      await notificationRepo.markAllRead(T, A);
      expect(await prisma.notificationRead.count({ where: { notificationId: foreign.id } })).toBe(0);
      expect(await notificationRepo.unreadCount(OTHER, A)).toBe(1);
    });

    it("unbekannte ID ist ein No-op", async () => {
      expect(await notificationRepo.markRead(T, A, "gibt-es-nicht")).toBe(false);
    });
  });

  describe("Idempotenz und Sammelquittung", () => {
    it("markRead ist wiederholbar und erzeugt genau eine Zeile", async () => {
      const t = await tenant("idem");
      const n = await notificationRepo.create({ tenantId: t, type: "x", title: "I" });
      expect(await notificationRepo.markRead(t, A, n.id)).toBe(true);
      const key = { notificationId_userEmail: { notificationId: n.id, userEmail: A } };
      const first = await prisma.notificationRead.findUniqueOrThrow({ where: key });
      expect(await notificationRepo.markRead(t, A, n.id)).toBe(true);
      expect(await prisma.notificationRead.count({ where: { notificationId: n.id } })).toBe(1);
      const second = await prisma.notificationRead.findUniqueOrThrow({ where: key });
      expect(second.readAt).toEqual(first.readAt); // erste Quittung bleibt erhalten
      expect(first.tenantId).toBe(t);
    });

    it("markAllRead quittiert nur für den Nutzer und ist wiederholbar", async () => {
      const t = await tenant("all");
      await notificationRepo.create({ tenantId: t, type: "x", title: "1" });
      await notificationRepo.create({ tenantId: t, type: "x", title: "2" });
      expect(await notificationRepo.markAllRead(t, A)).toBe(2);
      expect(await notificationRepo.unreadCount(t, A)).toBe(0);
      expect(await notificationRepo.unreadCount(t, B)).toBe(2);
      expect(await notificationRepo.markAllRead(t, A)).toBe(0);
      expect(await prisma.notificationRead.count({ where: { tenantId: t, userEmail: A } })).toBe(2);
    });
  });

  it("löscht Quittungen per Cascade mit der Meldung", async () => {
    const t = await tenant("cascade");
    const n = await notificationRepo.create({ tenantId: t, type: "x", title: "C" });
    await notificationRepo.markRead(t, A, n.id);
    await prisma.notification.delete({ where: { id: n.id } });
    expect(await prisma.notificationRead.count({ where: { notificationId: n.id } })).toBe(0);
  });
});
