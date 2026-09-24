import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { envelope, failure, pendingApproval, portalUser, refunds, users } from "../msw/fixtures";
import { server } from "../msw/server";
import { renderWithClient } from "../utils";
import AdminOverviewPage from "@/app/(app)/admin/page";
import AdminRefundsPage from "@/app/(app)/admin/refunds/page";
import ReportsPage from "@/app/(app)/admin/reports/page";
import { BulkUploader } from "@/app/(app)/disbursements/bulk/uploader";
import { SignInForm } from "@/app/(auth)/signin/signin-form";
import { PeoplePanel } from "@/components/people/people-panel";
import { PayoutSheet } from "@/components/payments/disbursement-dialog";
import { LedgerView } from "@/components/transactions/ledger-view";

const replace = vi.fn();
const push = vi.fn();
const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => searchParams,
}));

const adminSession = { role: "platform", env: "test", tenantId: null, userId: "usr-1", label: "Doris", canMake: true, canCheck: true, exp: 0, mode: "portal", environments: ["test"] };

function mockSession(overrides: Record<string, unknown> = {}) {
  server.use(http.get("*/api/auth/session", () => HttpResponse.json({ ...adminSession, ...overrides })));
}

describe("Sign in", () => {
  it("asks for the emailed code before signing an admin in", async () => {
    const user = userEvent.setup();
    let loginBody: unknown = null;
    let verifyBody: unknown = null;
    server.use(
      http.post("*/api/auth/login", async ({ request }) => {
        loginBody = await request.json();
        return HttpResponse.json({ requiresVerification: true, maskedEmail: "o***@afrikob.com", expiresIn: 600 });
      }),
      http.post("*/api/auth/verify-login", async ({ request }) => {
        verifyBody = await request.json();
        return HttpResponse.json({ ...portalUser, role: "platform", mode: "portal" });
      }),
    );
    renderWithClient(<SignInForm environments={["test"]} />);
    await user.type(screen.getByLabelText("Email"), "ops@afrikob.com");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    // The password alone must not sign anyone in.
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText("o***@afrikob.com")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("One-time code"), "654321");
    await user.click(screen.getByRole("button", { name: /Verify and sign in/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(loginBody).toEqual({ env: "test", email: "ops@afrikob.com", password: "correct horse" });
    expect(verifyBody).toEqual({ code: "654321" });
  });

  it("keeps the person on the code step when the code is wrong", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json({ requiresVerification: true, maskedEmail: "o***@afrikob.com", expiresIn: 600 }),
      ),
      http.post("*/api/auth/verify-login", () =>
        HttpResponse.json(failure("That code is not valid. Check your email and try again."), { status: 401 }),
      ),
    );
    renderWithClient(<SignInForm environments={["test"]} />);
    await user.type(screen.getByLabelText("Email"), "ops@afrikob.com");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.type(await screen.findByLabelText("One-time code"), "000000");
    await user.click(screen.getByRole("button", { name: /Verify and sign in/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code is not valid");
    expect(replace).not.toHaveBeenCalled();
  });

  it("switches to the API key tab for merchants and reports a rejected key", async () => {
    const user = userEvent.setup();
    server.use(http.post("*/api/auth/login", () => HttpResponse.json(failure("This API key was not accepted."), { status: 401 })));
    renderWithClient(<SignInForm environments={["test"]} />);
    await user.click(screen.getByRole("tab", { name: /Merchant/ }));
    await user.type(screen.getByLabelText("API key"), "tenant_key_0001");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This API key was not accepted.");
  });

  it("validates the email before calling the gateway", async () => {
    const user = userEvent.setup();
    renderWithClient(<SignInForm environments={["test"]} />);
    await user.type(screen.getByLabelText("Email"), "nope");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
  });
});

describe("Ledger", () => {
  it("shows collections with their state and totals", async () => {
    renderWithClient(<LedgerView title="Collections" description="d" kind="collection" noun="Collections" heroLabel="Collected" allowRefunds />);
    expect(await screen.findAllByText(/Afikob Limited Company/)).not.toHaveLength(0);
    expect(screen.queryByText(/Kofi Boateng/)).not.toBeInTheDocument();
    const settled = screen.getByText("Settled").closest("div") as HTMLElement;
    expect(within(settled).getByText("1")).toBeInTheDocument();
  });

  it("opens a record in the side sheet with its refunds", async () => {
    const user = userEvent.setup();
    renderWithClient(<LedgerView title="Transactions" description="d" noun="Transactions" heroLabel="Settled" />);
    const rows = await screen.findAllByText(/Kofi Boateng/);
    await user.click(rows[0]);
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("GHS 25.50")).toBeInTheDocument();
    expect(await within(sheet).findByText("None yet.")).toBeInTheDocument();
  });

  it("shows an error state with a retry", async () => {
    server.use(http.get("*/api/afrikob/transactions", () => HttpResponse.json(failure("Access denied"), { status: 403 })));
    renderWithClient(<LedgerView title="Transactions" description="d" noun="Transactions" heroLabel="Settled" />);
    expect(await screen.findByText("Access denied")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("Payouts", () => {
  it("checks the name, confirms, then sends", async () => {
    const user = userEvent.setup();
    let submitted: unknown = null;
    server.use(
      http.post("*/api/afrikob/payments/disbursement", async ({ request }) => {
        submitted = await request.json();
        return HttpResponse.json(envelope({ transactionId: "tx-new", status: "Pending", code: "000", message: "Accepted" }));
      }),
    );
    renderWithClient(<PayoutSheet open onOpenChange={() => {}} />);
    const institution = await screen.findByLabelText("Institution");
    await waitFor(() => expect(institution).not.toBeDisabled());
    await user.selectOptions(institution, "GCB");
    await user.type(screen.getByLabelText("Account or wallet number"), "851274680");
    await user.click(screen.getByRole("button", { name: "Check name" }));
    await waitFor(() => expect(screen.getByLabelText("Account name")).toHaveValue("KOFI BOATENG"));
    await user.type(screen.getByLabelText("Amount (GHS)"), "25");
    await user.type(screen.getByLabelText("Reference"), "Invoice 7");
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(await screen.findByRole("button", { name: "Send money" }));
    const sheet = await screen.findByRole("dialog");
    expect(await within(sheet).findByText("Payout submitted")).toBeInTheDocument();
    expect(submitted).toMatchObject({ accountNumber: "851274680", institutionCode: "GCB", amount: 25, accountName: "KOFI BOATENG" });
  });

  it("will not review an incomplete payout", async () => {
    const user = userEvent.setup();
    renderWithClient(<PayoutSheet open onOpenChange={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "Review" }));
    expect(await screen.findByText("Institution is required")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send money" })).not.toBeInTheDocument();
  });
});

describe("Bulk payouts", () => {
  it("flags bad rows and sends only the valid ones", async () => {
    const user = userEvent.setup();
    let captured: { body: { disbursements: unknown[] }; batch: string | null } | null = null;
    server.use(
      http.post("*/api/afrikob/payments/bulk-name-verify", () =>
        HttpResponse.json(envelope({ results: [{ accountName: "AMA MENSAH", accountNumber: "0241234567", status: "ok", message: null }] })),
      ),
      http.post("*/api/afrikob/payments/bulk-disbursements", async ({ request }) => {
        captured = { body: (await request.json()) as { disbursements: unknown[] }, batch: request.headers.get("clientbatchid") };
        return HttpResponse.json(envelope({ id: "B-42", status: "Queued", itemCount: 1, totalAmount: 10, currency: "GHS" }));
      }),
    );
    renderWithClient(<BulkUploader />);
    const csv = "accountNumber,institutionCode,accountName,amount,reference\n0241234567,MTN,Ama Mensah,10,r1\n12,MTN,Bad,abc,r2\n";
    await user.upload(screen.getByLabelText(/Drop a CSV/), new File([csv], "pay.csv", { type: "text/csv" }));
    expect(await screen.findByText(/1 of 2 rows ready/)).toBeInTheDocument();
    expect(screen.getByText(/accountNumber: Enter a valid/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Check names" }));
    expect(await screen.findByText("Match")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send batch" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Send batch" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/disbursements/bulk/B-42"));
    expect(captured!.body.disbursements).toHaveLength(1);
    expect(captured!.batch).toMatch(/^BATCH-/);
  });
});

describe("Admin refunds", () => {
  it("approves a waiting refund and refreshes the list", async () => {
    const user = userEvent.setup();
    let approved = false;
    let listCalls = 0;
    mockSession();
    server.use(
      http.get("*/api/afrikob/admin/refunds", () => {
        listCalls += 1;
        return HttpResponse.json(envelope(approved ? [{ ...refunds[0], status: "Approved" }] : refunds));
      }),
      http.post("*/api/afrikob/admin/refunds/ref-1/approve", () => {
        approved = true;
        return HttpResponse.json(envelope({ ...refunds[0], status: "Approved" }));
      }),
    );
    renderWithClient(<AdminRefundsPage />);
    await user.click((await screen.findAllByRole("button", { name: "Refund actions" }))[0]);
    await user.click(await screen.findByRole("menuitem", { name: /Approve/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(approved).toBe(true));
    await waitFor(() => expect(listCalls).toBeGreaterThan(1));
  });

  it("reports a maker-checker hold instead of claiming the refund was approved", async () => {
    const user = userEvent.setup();
    mockSession();
    server.use(http.post("*/api/afrikob/admin/refunds/ref-1/approve", () => HttpResponse.json(pendingApproval("apr-3"), { status: 202 })));
    renderWithClient(<AdminRefundsPage />);
    await user.click((await screen.findAllByRole("button", { name: "Refund actions" }))[0]);
    await user.click(await screen.findByRole("menuitem", { name: /Approve/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Sent for approval.")).toBeInTheDocument();
  });

  it("hides approve and reject from someone who cannot check", async () => {
    const user = userEvent.setup();
    mockSession({ canCheck: false });
    renderWithClient(<AdminRefundsPage />);
    await user.click((await screen.findAllByRole("button", { name: "Refund actions" }))[0]);
    expect(await screen.findByRole("menuitem", { name: /Approve/ })).toHaveAttribute("data-disabled");
    expect(screen.getByRole("menuitem", { name: /Reject/ })).toHaveAttribute("data-disabled");
  });
});

describe("Admin people", () => {
  it("adds a person with maker-checker permissions", async () => {
    const user = userEvent.setup();
    let created: unknown = null;
    server.use(
      http.post("*/api/afrikob/admin/users", async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(envelope(users[0]));
      }),
    );
    renderWithClient(<PeoplePanel scope="platform" />);
    await user.click(await screen.findByRole("button", { name: /Add person/ }));
    const sheet = await screen.findByRole("dialog");
    await user.type(within(sheet).getByLabelText("Name"), "Yaw Owusu");
    await user.type(within(sheet).getByLabelText("Email"), "yaw@afrikob.com");
    await user.type(within(sheet).getByLabelText("Temporary password"), "first-password");
    await user.click(within(sheet).getByLabelText("Can approve what others submit"));
    await user.click(within(sheet).getByRole("button", { name: "Add person" }));
    await waitFor(() =>
      expect(created).toMatchObject({
        email: "yaw@afrikob.com",
        displayName: "Yaw Owusu",
        canMake: true,
        canCheck: true,
        isTenantAdmin: false,
        isPlatformAdmin: false,
        preferredNotificationChannel: "Email",
      }),
    );
  });

  it("confirms before deactivating someone", async () => {
    const user = userEvent.setup();
    let deactivated = false;
    server.use(
      http.post("*/api/afrikob/admin/users/usr-1/deactivate", () => {
        deactivated = true;
        return HttpResponse.json(envelope({ deactivated: true }));
      }),
    );
    renderWithClient(<PeoplePanel scope="platform" />);
    await user.click((await screen.findAllByRole("button", { name: "User actions" }))[0]);
    await user.click(await screen.findByRole("menuitem", { name: /Deactivate/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(deactivated).toBe(true));
  });
});

describe("Admin overview", () => {
  it("reads the admin reports and never the tenant-only endpoints", async () => {
    const called: string[] = [];
    server.use(
      http.get("*/api/afrikob/*", ({ request }) => {
        const path = new URL(request.url).pathname.replace("/api/afrikob/", "");
        called.push(path);
        return HttpResponse.json(envelope([]));
      }),
    );
    renderWithClient(<AdminOverviewPage />);
    await waitFor(() => expect(called).toContain("admin/reports/collections/list"));
    await waitFor(() => expect(called).toContain("admin/reports/disbursements/list"));

    // The gateway refuses these for a staff session; asking would log people out.
    expect(called).not.toContain("transactions");
    expect(called).not.toContain("payments/collection-balance");
    expect(called).not.toContain("payments/disbursement-balance");
  });

  it("asks for a recent window rather than everything ever", async () => {
    let search = "";
    server.use(
      http.get("*/api/afrikob/admin/reports/collections/list", ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json(envelope([]));
      }),
    );
    renderWithClient(<AdminOverviewPage />);
    await waitFor(() => expect(search).toMatch(/fromDate=\d{4}-\d{2}-\d{2}/));
  });
});

describe("Reports", () => {
  it("filters by tenant and date, and totals the rows", async () => {
    const user = userEvent.setup();
    let lastSearch = "";
    server.use(
      http.get("*/api/afrikob/admin/reports/collections/list", ({ request }) => {
        lastSearch = new URL(request.url).search;
        return HttpResponse.json(envelope([]));
      }),
    );
    renderWithClient(<ReportsPage />);
    await waitFor(() => expect(screen.getByLabelText("Tenant")).toBeInTheDocument());
    await user.selectOptions(await screen.findByLabelText("Tenant"), "ten-1");
    await user.type(screen.getByLabelText("From"), "2026-09-01");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(lastSearch).toContain("tenantId=ten-1"));
    expect(lastSearch).toContain("fromDate=2026-09-01");
  });
});
