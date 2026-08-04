import { describe, it, expect, afterEach, vi } from "vitest";
import { makeRequest } from "./helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));

// Die eigentliche Arbeit der Routen wird ausgeklammert: hier steht das
// Auth-Gate zur Prüfung, nicht Versand, Polling oder Versiegelung.
vi.mock("@/lib/services/webhook-worker", () => ({
  runWebhookWorker: vi.fn(async () => ({ processed: 0 })),
}));
vi.mock("@/lib/services/sftp-service", () => ({
  sftpService: { pollAll: vi.fn(async () => []) },
}));
vi.mock("@/lib/audit/seal", () => ({
  sealYesterdayForAllTenants: vi.fn(async () => []),
  sealDay: vi.fn(async () => null),
}));

import { POST as sealPost } from "@/app/api/internal/audit/seal/route";
import { POST as dispatchPost } from "@/app/api/internal/webhooks/dispatch/route";
import { POST as sftpPollPost } from "@/app/api/internal/edi/sftp-poll/route";

const SECRET = "cron-secret-für-den-test";
const HEADER = "x-internal-cron-secret";

const ROUTES: Array<{ name: string; url: string; call: typeof sealPost }> = [
  { name: "audit/seal", url: "http://localhost/api/internal/audit/seal", call: sealPost },
  { name: "webhooks/dispatch", url: "http://localhost/api/internal/webhooks/dispatch", call: dispatchPost },
  { name: "edi/sftp-poll", url: "http://localhost/api/internal/edi/sftp-poll", call: sftpPollPost },
];

afterEach(() => {
  delete process.env.CRON_SECRET;
});

/**
 * Diese drei Routen sind ohne Session aus dem Internet erreichbar
 * (`PUBLIC_PATHS` in der Middleware); der geteilte Secret-Header ist ihr
 * einziges Tor. Jede Route wird deshalb gegen dieselben Fälle geprüft.
 */
describe.each(ROUTES)("/api/internal/$name", ({ url, call }) => {
  it("weist einen Aufruf ohne Secret-Header ab (401)", async () => {
    process.env.CRON_SECRET = SECRET;
    const res = await call(makeRequest(url, { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("weist ein falsches Secret ab (401)", async () => {
    process.env.CRON_SECRET = SECRET;
    const res = await call(makeRequest(url, { method: "POST", headers: { [HEADER]: "falsch" } }));
    expect(res.status).toBe(401);
  });

  it("weist ein Secret ab, das nur ein Präfix des echten ist (401)", async () => {
    process.env.CRON_SECRET = SECRET;
    const res = await call(
      makeRequest(url, { method: "POST", headers: { [HEADER]: SECRET.slice(0, -1) } }),
    );
    expect(res.status).toBe(401);
  });

  it("lässt den Aufruf mit korrektem Secret durch (200)", async () => {
    process.env.CRON_SECRET = SECRET;
    const res = await call(makeRequest(url, { method: "POST", headers: { [HEADER]: SECRET } }));
    expect(res.status).toBe(200);
  });

  it("antwortet 503, wenn der Server kein CRON_SECRET gesetzt hat", async () => {
    const res = await call(makeRequest(url, { method: "POST", headers: { [HEADER]: SECRET } }));
    expect(res.status).toBe(503);
  });
});
