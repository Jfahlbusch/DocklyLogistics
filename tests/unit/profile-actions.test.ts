import { afterEach, describe, expect, it, vi } from "vitest";

const { calls, store, signOut } = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    store: { delete: vi.fn((name: string) => void calls.push(`delete:${name}`)) },
    signOut: vi.fn(async () => void calls.push("signOut")),
  };
});

vi.mock("next/headers", () => ({ cookies: async () => store }));
vi.mock("@/lib/auth", () => ({ signOut }));

import { logoutAction } from "@/components/layout/profile-actions";

afterEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});

describe("logoutAction", () => {
  it("beendet eine Mandanten-Ansicht (Cookie admin_view_tenant) und meldet danach ab", async () => {
    await logoutAction();
    expect(calls).toEqual(["delete:admin_view_tenant", "signOut"]);
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});
