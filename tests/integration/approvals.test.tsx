import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { approvals, envelope } from "../msw/fixtures";
import { server } from "../msw/server";
import { renderWithClient } from "../utils";
import TenantAdminPage from "@/app/(app)/tenant-admin/page";
import { ApprovalsInbox } from "@/components/approvals/approvals-inbox";
import { PeoplePanel } from "@/components/people/people-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/tenant-admin",
  useSearchParams: () => new URLSearchParams(),
}));

const session = {
  role: "platform",
  env: "test",
  tenantId: null,
  userId: "usr-1",
  label: "Doris",
  canMake: true,
  canCheck: true,
  exp: 0,
  mode: "portal",
  environments: ["test"],
};

const mockSession = (overrides: Record<string, unknown> = {}) =>
  server.use(http.get("*/api/auth/session", () => HttpResponse.json({ ...session, ...overrides })));

describe("Approvals inbox", () => {
  it("lists what is waiting and shows what the action would do", async () => {
    const user = userEvent.setup();
    mockSession();
    renderWithClient(<ApprovalsInbox scope="platform" description="d" />);

    expect(await screen.findAllByText("Wallet Topup")).not.toHaveLength(0);
    await user.click(screen.getAllByText("Wallet Topup")[0]);
    const sheet = await screen.findByRole("dialog");
    // The held payload is read, not dumped as JSON.
    expect(within(sheet).getByText("Amount")).toBeInTheDocument();
    expect(within(sheet).getByText("GHS 2,500.00")).toBeInTheDocument();
    expect(within(sheet).getByText("DEP-771")).toBeInTheDocument();
  });

  it("approves a request and refreshes the list", async () => {
    const user = userEvent.setup();
    let decided: unknown = null;
    let listCalls = 0;
    mockSession();
    server.use(
      http.get("*/api/afrikob/admin/approvals", () => {
        listCalls += 1;
        return HttpResponse.json(envelope(approvals));
      }),
      http.post("*/api/afrikob/admin/approvals/apr-1/decide", async ({ request }) => {
        decided = await request.json();
        return HttpResponse.json(envelope({ ...approvals[0], status: "Approved" }));
      }),
    );
    renderWithClient(<ApprovalsInbox scope="platform" description="d" />);
    await user.click((await screen.findAllByRole("button", { name: "Request actions" }))[0]);
    await user.click(await screen.findByRole("menuitem", { name: /Approve/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(decided).toEqual({ approve: true, comment: undefined }));
    await waitFor(() => expect(listCalls).toBeGreaterThan(1));
  });

  it("will not reject without a reason", async () => {
    const user = userEvent.setup();
    let called = false;
    mockSession();
    server.use(
      http.post("*/api/afrikob/admin/approvals/apr-1/decide", () => {
        called = true;
        return HttpResponse.json(envelope(approvals[0]));
      }),
    );
    renderWithClient(<ApprovalsInbox scope="platform" description="d" />);
    await user.click((await screen.findAllByRole("button", { name: "Request actions" }))[0]);
    await user.click(await screen.findByRole("menuitem", { name: /Reject/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("Say why you are rejecting it")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("hides the decision from someone who cannot approve", async () => {
    const user = userEvent.setup();
    mockSession({ canCheck: false });
    renderWithClient(<ApprovalsInbox scope="platform" description="d" />);
    await user.click((await screen.findAllByRole("button", { name: "Request actions" }))[0]);
    expect(await screen.findByRole("menuitem", { name: /Approve/ })).toHaveAttribute("data-disabled");
  });
});

describe("Tenant admin", () => {
  it("shows the tenant's limits and wallets", async () => {
    mockSession({ role: "tenant-admin", tenantId: "ten-1" });
    renderWithClient(<TenantAdminPage />);
    expect(await screen.findByRole("heading", { name: "Afikob" })).toBeInTheDocument();
    expect(await screen.findAllByText("GHS 9,958.60")).not.toHaveLength(0);
    expect(screen.getByText("Required before a payout")).toBeInTheDocument();
    expect(screen.getAllByText(/Collection/).length).toBeGreaterThan(0);
  });

  it("requests funds rather than moving them", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    mockSession({ role: "tenant-admin", tenantId: "ten-1" });
    server.use(
      http.post("*/api/afrikob/tenant-admin/wallets/topup-request", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope({ pendingApproval: true, approvalRequestId: "apr-9" }), { status: 202 });
      }),
    );
    renderWithClient(<TenantAdminPage />);
    await user.click(await screen.findByRole("button", { name: /Request funds/ }));
    const sheet = await screen.findByRole("dialog");
    await user.type(within(sheet).getByLabelText("Amount"), "2500");
    await user.type(within(sheet).getByLabelText("Reference"), "DEP-772");
    await user.click(within(sheet).getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(body).toMatchObject({ amount: 2500, reference: "DEP-772", currency: "GHS" }));
    expect(await screen.findByText(/waiting in Approvals/i)).toBeInTheDocument();
  });

  it("creates a tenant person without platform-only fields", async () => {
    const user = userEvent.setup();
    let created: Record<string, unknown> | null = null;
    mockSession({ role: "tenant-admin", tenantId: "ten-1" });
    server.use(
      http.post("*/api/afrikob/tenant-admin/users", async ({ request }) => {
        created = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(envelope({ id: "usr-9", email: "new@afikob.com" }));
      }),
    );
    renderWithClient(<PeoplePanel scope="tenant-admin" />);
    await user.click(await screen.findByRole("button", { name: /Add person/ }));
    const sheet = await screen.findByRole("dialog");
    await user.type(within(sheet).getByLabelText("Name"), "Akosua Mensah");
    await user.type(within(sheet).getByLabelText("Email"), "new@afikob.com");
    await user.type(within(sheet).getByLabelText("Temporary password"), "first-password");
    await user.click(within(sheet).getByLabelText("Can administer the tenant"));
    await user.click(within(sheet).getByRole("button", { name: "Add person" }));

    await waitFor(() => expect(created).toMatchObject({ email: "new@afikob.com", isTenantAdmin: true }));
    // A tenant admin cannot grant platform rights or move someone between tenants.
    expect(created).not.toHaveProperty("isPlatformAdmin");
    expect(created).not.toHaveProperty("tenantId");
    expect(created).not.toHaveProperty("userType");
  });
});
