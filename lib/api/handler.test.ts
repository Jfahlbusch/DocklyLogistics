import { describe, it, expect } from "vitest";
import { z } from "zod";
import { handler } from "./handler";
import { ForbiddenError, UnauthenticatedError } from "./guard";
import { ok } from "./respond";

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("handler", () => {
  it("returns 200 on success", async () => {
    const wrapped = handler(async () => ok({ hello: "world" }));
    const res = await wrapped();
    expect(res.status).toBe(200);
    const body = await readJson(res) as { data: { hello: string } };
    expect(body.data.hello).toBe("world");
  });

  it("maps UnauthenticatedError to 401", async () => {
    const wrapped = handler(async () => {
      throw new UnauthenticatedError("nope");
    });
    const res = await wrapped();
    expect(res.status).toBe(401);
    const body = await readJson(res) as { title: string; detail: string };
    expect(body.title).toBe("Unauthenticated");
    expect(body.detail).toBe("nope");
  });

  it("maps ForbiddenError to 403", async () => {
    const wrapped = handler(async () => {
      throw new ForbiddenError("not your tenant");
    });
    const res = await wrapped();
    expect(res.status).toBe(403);
  });

  it("maps ZodError to 422 with fieldErrors", async () => {
    const wrapped = handler(async () => {
      z.object({ x: z.string() }).parse({ x: 123 });
      return ok({});
    });
    const res = await wrapped();
    expect(res.status).toBe(422);
    const body = await readJson(res) as { title: string; errors: unknown };
    expect(body.title).toBe("Validation failed");
    expect(body.errors).toBeDefined();
  });
});
