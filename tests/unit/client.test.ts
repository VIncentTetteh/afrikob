import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { envelope, failure, pendingApproval, problem } from "../msw/fixtures";
import { server } from "../msw/server";
import { buildUrl, download, onUnauthorized, request, requestResult } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";

describe("buildUrl", () => {
  it("drops empty query values and strips leading slashes", () => {
    expect(buildUrl("/admin/refunds", { status: "", page: 1, x: undefined, y: null })).toBe("/api/afrikob/admin/refunds?page=1");
  });
});

describe("request", () => {
  it("unwraps envelope data and applies the schema", async () => {
    server.use(http.get("*/api/afrikob/ping", () => HttpResponse.json(envelope({ value: "2" }))));
    await expect(request("GET", "ping", { schema: z.object({ value: z.coerce.number() }) })).resolves.toEqual({ value: 2 });
  });

  it("sends JSON body, CSRF header and custom headers on writes", async () => {
    document.cookie = "afk_csrf=csrf-123";
    let seen: { csrf: string | null; idem: string | null; body: unknown } | null = null;
    server.use(
      http.post("*/api/afrikob/write", async ({ request: req }) => {
        seen = { csrf: req.headers.get("x-csrf-token"), idem: req.headers.get("idempotency-key"), body: await req.json() };
        return HttpResponse.json(envelope({ ok: true }));
      }),
    );
    await request("POST", "write", { body: { a: 1 }, headers: { "Idempotency-Key": "k1" }, schema: z.unknown() });
    expect(seen).toEqual({ csrf: "csrf-123", idem: "k1", body: { a: 1 } });
  });

  it("treats statusCode 0 as success and a failed envelope with no data as an error", async () => {
    server.use(http.get("*/api/afrikob/ok", () => HttpResponse.json(envelope({ n: 1 }, { statusCode: 0 }))));
    await expect(request("GET", "ok", { schema: z.object({ n: z.number() }) })).resolves.toEqual({ n: 1 });

    server.use(http.post("*/api/afrikob/soft-fail", () => HttpResponse.json(failure("Insufficient balance"))));
    await expect(request("POST", "soft-fail", { schema: z.unknown() })).rejects.toMatchObject({
      status: 422,
      message: "Insufficient balance",
    });
  });

  it("passes through a non-zero status code that still carries data", async () => {
    server.use(http.post("*/api/afrikob/queued", () => HttpResponse.json(envelope({ status: "Queued" }, { statusCode: 3 }))));
    await expect(request("POST", "queued", { schema: z.object({ status: z.string() }) })).resolves.toEqual({ status: "Queued" });
  });

  it("reports a 202 pending approval as a pending result, not data", async () => {
    server.use(http.post("*/api/afrikob/approve", () => HttpResponse.json(pendingApproval("apr-7"), { status: 202 })));
    const result = await requestResult("POST", "approve", { schema: z.unknown() });
    expect(result.pending).toEqual({ pendingApproval: true, approvalRequestId: "apr-7", message: "Sent for approval." });
    expect(result.data).toBeUndefined();
    await expect(request("POST", "approve", { schema: z.unknown() })).rejects.toMatchObject({ status: 202 });
  });

  it("handles 204 with an empty body", async () => {
    server.use(http.delete("*/api/afrikob/gone", () => new HttpResponse(null, { status: 204 })));
    await expect(request("DELETE", "gone", { schema: z.unknown().transform(() => null) })).resolves.toBeNull();
  });

  it("maps ProblemDetails and envelope errors into ApiError", async () => {
    server.use(
      http.get("*/api/afrikob/problem", () => HttpResponse.json(problem("Validation failed", "Amount must be positive"), { status: 400 })),
    );
    const detail = (await request("GET", "problem", { schema: z.unknown() }).catch((e: unknown) => e)) as ApiError;
    expect(detail.message).toBe("Amount must be positive");

    server.use(
      http.post("*/api/afrikob/bad", () =>
        HttpResponse.json(failure("Validation failed", { errors: ["amount invalid"], validationErrors: { Amount: ["must be > 0"] } }), {
          status: 400,
          headers: { "x-request-id": "rid-1" },
        }),
      ),
    );
    const err = (await request("POST", "bad", { body: {}, schema: z.unknown() }).catch((e: unknown) => e)) as ApiError;
    expect(err.fieldErrors).toEqual({ Amount: "must be > 0" });
    expect(err.requestId).toBe("rid-1");
    expect(errorMessage(err)).toBe("Validation failed amount invalid must be > 0");
  });

  it("notifies unauthorized listeners on 401", async () => {
    const listener = vi.fn();
    const off = onUnauthorized(listener);
    server.use(http.get("*/api/afrikob/secure", () => HttpResponse.json(failure("expired"), { status: 401 })));
    const err = (await request("GET", "secure", { schema: z.unknown() }).catch((e: unknown) => e)) as ApiError;
    expect(err.isUnauthorized).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    off();
  });

  it("reports schema mismatches as a 500 ApiError", async () => {
    server.use(http.get("*/api/afrikob/shape", () => HttpResponse.json(envelope({ n: "x" }))));
    await expect(request("GET", "shape", { schema: z.object({ n: z.number() }) })).rejects.toMatchObject({ status: 500 });
  });
});

describe("download", () => {
  it("returns the blob and the filename from content-disposition", async () => {
    server.use(
      http.get("*/api/afrikob/admin/reports/collections", () =>
        HttpResponse.text("a,b\n1,2", {
          headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="collections-sept.csv"' },
        }),
      ),
    );
    const file = await download("admin/reports/collections", { tenantId: "ten-1" });
    expect(file.filename).toBe("collections-sept.csv");
    expect(await file.blob.text()).toBe("a,b\n1,2");
  });

  it("falls back to a filename and surfaces errors", async () => {
    server.use(http.get("*/api/afrikob/admin/reports/disbursements", () => HttpResponse.text("x", { headers: { "content-type": "text/csv" } })));
    expect((await download("admin/reports/disbursements")).filename).toBe("disbursements.csv");

    server.use(http.get("*/api/afrikob/admin/reports/collections", () => HttpResponse.json(failure("Denied"), { status: 403 })));
    await expect(download("admin/reports/collections")).rejects.toMatchObject({ status: 403, message: "Denied" });
  });
});

describe("ApiError helpers", () => {
  it("exposes status predicates and generic messages", () => {
    expect(new ApiError({ status: 403, message: "x" }).isForbidden).toBe(true);
    expect(new ApiError({ status: 429, message: "x" }).isRateLimited).toBe(true);
    expect(errorMessage(new Error("plain"))).toBe("plain");
    expect(errorMessage("weird")).toBe("Something went wrong.");
  });
});
