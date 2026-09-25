import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { server } from "../msw/server";
import { renderWithClient } from "../utils";
import AppLayout from "@/app/(app)/layout";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/admin/refunds",
  useSearchParams: () => new URLSearchParams(),
}));

const SESSION = {
  role: "platform", env: "test", tenantId: null, userId: "usr-1", label: "Doris",
  canMake: true, canCheck: true, exp: 0, environments: ["test"],
};

beforeEach(() => replace.mockClear());

/**
 * A signed-in operator must only be sent back to sign-in when the gateway
 * actually says they are signed out. Treating any failed session read as a
 * sign-out threw people out mid-task whenever the network hiccuped.
 */
describe("staying signed in through a rough patch", () => {
  it("rides out a failed session read and keeps working", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/auth/session", () => {
        calls += 1;
        // Two failures, as a sleeping laptop or a cold start would produce.
        return calls <= 2 ? HttpResponse.error() : HttpResponse.json(SESSION);
      }),
    );

    renderWithClient(<AppLayout>the page</AppLayout>);

    await waitFor(() => expect(screen.getByText("the page")).toBeInTheDocument(), { timeout: 5000 });
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs out on a real 401, and remembers the page to come back to", async () => {
    server.use(http.get("*/api/auth/session", () => HttpResponse.json({ message: "Not signed in." }, { status: 401 })));

    renderWithClient(<AppLayout>the page</AppLayout>);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace.mock.calls[0][0]).toContain("reason=expired");
    expect(replace.mock.calls[0][0]).toContain("next=%2Fadmin%2Frefunds");
  });
});
