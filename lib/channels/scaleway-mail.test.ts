import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Buffer } from "node:buffer";
import { getScalewayTemConfig, sendViaScalewayTem, type ScalewayTemConfig } from "./scaleway-mail";

const CFG: ScalewayTemConfig = { secretKey: "scw-secret", projectId: "proj-123", region: "fr-par" };

describe("getScalewayTemConfig", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("liefert null ohne Secret/Project", () => {
    delete process.env.SCALEWAY_TEM_SECRET_KEY;
    delete process.env.SCALEWAY_TEM_PROJECT_ID;
    expect(getScalewayTemConfig()).toBeNull();
  });

  it("liefert Config mit Default-Region fr-par", () => {
    process.env.SCALEWAY_TEM_SECRET_KEY = "k";
    process.env.SCALEWAY_TEM_PROJECT_ID = "p";
    delete process.env.SCALEWAY_TEM_REGION;
    expect(getScalewayTemConfig()).toEqual({ secretKey: "k", projectId: "p", region: "fr-par" });
  });

  it("übernimmt gesetzte Region", () => {
    process.env.SCALEWAY_TEM_SECRET_KEY = "k";
    process.env.SCALEWAY_TEM_PROJECT_ID = "p";
    process.env.SCALEWAY_TEM_REGION = "nl-ams";
    expect(getScalewayTemConfig()?.region).toBe("nl-ams");
  });
});

describe("sendViaScalewayTem", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTet an die Regions-URL mit X-Auth-Token und korrektem Body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ emails: [{ message_id: "msg-1" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendViaScalewayTem(CFG, {
      from: { email: "from@x.de", name: "Absender" },
      to: "to@y.de",
      cc: ["c@z.de"],
      replyTo: "reply@x.de",
      subject: "Bestellung 1",
      text: "Hallo",
      attachments: [{ name: "o.pdf", type: "application/pdf", content: Buffer.from("PDFDATA") }],
    });

    expect(res.messageId).toBe("msg-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails",
    );
    expect((init.headers as Record<string, string>)["X-Auth-Token"]).toBe("scw-secret");
    const body = JSON.parse(init.body as string);
    expect(body.from).toEqual({ email: "from@x.de", name: "Absender" });
    expect(body.to).toEqual([{ email: "to@y.de" }]);
    expect(body.cc).toEqual([{ email: "c@z.de" }]);
    expect(body.project_id).toBe("proj-123");
    expect(body.attachments[0].content).toBe(Buffer.from("PDFDATA").toString("base64"));
    expect(body.additional_headers).toEqual([{ key: "Reply-To", value: "reply@x.de" }]);
  });

  it("wirft bei non-2xx mit Detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("domain not verified", { status: 403 })),
    );
    await expect(
      sendViaScalewayTem(CFG, { from: { email: "a@b.de", name: "A" }, to: "c@d.de", subject: "s", text: "t" }),
    ).rejects.toThrow(/Scaleway TEM 403/);
  });

  it("wirft bei Anhang über 2 MB", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const big = Buffer.alloc(2 * 1024 * 1024 + 1);
    await expect(
      sendViaScalewayTem(CFG, {
        from: { email: "a@b.de", name: "A" },
        to: "c@d.de",
        subject: "s",
        text: "t",
        attachments: [{ name: "big.pdf", type: "application/pdf", content: big }],
      }),
    ).rejects.toThrow(/2 MB/);
  });
});
