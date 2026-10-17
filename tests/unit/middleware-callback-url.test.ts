import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// `auth(handler)` liefert in der echten App den Handler mit req.auth; hier direkt durchreichen.
vi.mock("@/lib/auth", () => ({
  auth: (handler: (req: NextRequest & { auth: unknown }) => unknown) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: null })),
}));

import middleware from "@/middleware";

async function redirectFor(url: string) {
  const res = (await (middleware as unknown as (r: NextRequest) => Promise<Response>)(new NextRequest(url))) as Response;
  return { status: res.status, location: new URL(res.headers.get("location")!) };
}

describe("middleware: Umleitung ohne Sitzung", () => {
  it("behält bei /warehouse-mode?zone=… die Query im callbackUrl", async () => {
    const { status, location } = await redirectFor("https://logistics.dockly.de/warehouse-mode?zone=z1");
    expect(status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe("/warehouse-mode?zone=z1");
  });

  it("kodiert Sonderzeichen der Query sauber (kein Parameter-Ausbruch)", async () => {
    const { location } = await redirectFor("https://logistics.dockly.de/warehouse-mode?zone=a&i=3");
    expect(location.searchParams.get("callbackUrl")).toBe("/warehouse-mode?zone=a&i=3");
    expect([...location.searchParams.keys()]).toEqual(["callbackUrl"]);
  });

  it("Pfad ohne Query bleibt unverändert", async () => {
    const { location } = await redirectFor("https://logistics.dockly.de/orders");
    expect(location.searchParams.get("callbackUrl")).toBe("/orders");
  });
});
