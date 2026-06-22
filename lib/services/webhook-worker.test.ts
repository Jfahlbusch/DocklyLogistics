import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/repos/webhook", () => ({
  deliveryRepo: {
    fetchDue: vi.fn(),
    markSuccess: vi.fn(async () => {}),
    markFailedRetryLater: vi.fn(async () => {}),
    markGivenUp: vi.fn(async () => {}),
  },
}));
vi.mock("@/lib/crypto/aes", () => ({ decryptSecret: vi.fn(() => "secret") }));
vi.mock("./webhook-sign", () => ({ signWebhook: vi.fn(() => ({ timestamp: "t", signature: "sig" })) }));

import { runWebhookWorker } from "./webhook-worker";
import { deliveryRepo } from "@/lib/db/repos/webhook";
import { decryptSecret } from "@/lib/crypto/aes";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function delivery(over: Record<string, unknown> = {}) {
  return {
    id: "d1",
    tenantId: "t",
    event: "order.sent",
    payload: {},
    attempts: 0,
    webhook: { url: "https://example.test/hook", secretEncrypted: "enc" },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(decryptSecret).mockReturnValue("secret");
});

describe("runWebhookWorker", () => {
  it("marks success on a 2xx response", async () => {
    vi.mocked(deliveryRepo.fetchDue).mockResolvedValue([delivery()] as never);
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
    const r = await runWebhookWorker(10);
    expect(deliveryRepo.markSuccess).toHaveBeenCalledWith("d1", 200);
    expect(r.succeeded).toBe(1);
  });

  it("schedules a retry on a transient failure below the max", async () => {
    vi.mocked(deliveryRepo.fetchDue).mockResolvedValue([delivery({ attempts: 2 })] as never);
    fetchMock.mockResolvedValue(new Response("err", { status: 500 }));
    const r = await runWebhookWorker(10);
    expect(deliveryRepo.markFailedRetryLater).toHaveBeenCalled();
    expect(deliveryRepo.markGivenUp).not.toHaveBeenCalled();
    expect(r.failed).toBe(1);
  });

  it("gives up after the final (8th) attempt", async () => {
    vi.mocked(deliveryRepo.fetchDue).mockResolvedValue([delivery({ attempts: 7 })] as never);
    fetchMock.mockResolvedValue(new Response("err", { status: 500 }));
    const r = await runWebhookWorker(10);
    expect(deliveryRepo.markGivenUp).toHaveBeenCalled();
    expect(r.givenUp).toBe(1);
  });

  it("gives up immediately when the secret cannot be decrypted", async () => {
    vi.mocked(deliveryRepo.fetchDue).mockResolvedValue([delivery()] as never);
    vi.mocked(decryptSecret).mockImplementation(() => {
      throw new Error("bad key");
    });
    const r = await runWebhookWorker(10);
    expect(deliveryRepo.markGivenUp).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.givenUp).toBe(1);
  });

  it("gives up on a network exception at the final attempt", async () => {
    vi.mocked(deliveryRepo.fetchDue).mockResolvedValue([delivery({ attempts: 7 })] as never);
    fetchMock.mockRejectedValue(new Error("network down"));
    await runWebhookWorker(10);
    expect(deliveryRepo.markGivenUp).toHaveBeenCalled();
  });
});
