import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: "ops@afrikob.com", password: "correct-horse" };
const TENANT_ADMIN = { email: "owner@afikob.com", password: "tenant-horse" };
const TENANT_CLERK = { email: "clerk@afikob.com", password: "tenant-clerk" };
const TENANT_KEY = "e2e-tenant-key-0001";
/** The mock gateway always emails this code. */
const LOGIN_CODE = "654321";

/** Password step only: the code is still outstanding afterwards. */
async function submitPassword(page: Page, password = ADMIN.password, email = ADMIN.email) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signInWithPassword(page: Page, email: string, password: string) {
  await submitPassword(page, password, email);
  await page.getByLabel("One-time code").fill(LOGIN_CODE);
  await page.getByRole("button", { name: /Verify and sign in/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/signin"));
}

async function signInAsAdmin(page: Page, password = ADMIN.password) {
  await submitPassword(page, password);
  await page.getByLabel("One-time code").fill(LOGIN_CODE);
  await page.getByRole("button", { name: /Verify and sign in/ }).click();
  // Wait for the session to exist before the test navigates anywhere.
  await page.waitForURL((url) => !url.pathname.startsWith("/signin"));
}

async function signInWithKey(page: Page, key: string) {
  await page.goto("/signin");
  await page.getByRole("tab", { name: /Merchant/ }).click();
  await page.getByLabel("API key", { exact: true }).fill(key);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/signin"));
}

const visible = (page: Page, text: string) => page.getByText(text).filter({ visible: true }).first();

test.describe.configure({ mode: "serial" });

let clientIp = 0;

test.beforeEach(async ({ request, context }) => {
  await request.post("http://localhost:4010/__reset");
  // Each test gets its own address so one test's sign-in attempts do not
  // exhaust the login rate limit for the next.
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `203.0.113.${(clientIp += 1) % 250}` });
});

test("will not sign an admin in until the emailed code is verified", async ({ page }) => {
  await submitPassword(page);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText("o***@afrikob.com")).toBeVisible();

  // The password alone is not a session: the app stays shut, holding the page
  // they asked for so signing in properly takes them there.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/signin\?next=%2Fadmin$/);

  await submitPassword(page);
  await page.getByLabel("One-time code").fill("000000");
  await page.getByRole("button", { name: /Verify and sign in/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "not valid" })).toBeVisible();

  await page.getByLabel("One-time code").fill(LOGIN_CODE);
  await page.getByRole("button", { name: /Verify and sign in/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("shows the landing page to visitors and explains a bad password", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Move money across Ghana/ })).toBeVisible();
  await page.getByRole("link", { name: "Sign in" }).first().click();
  await expect(page).toHaveURL(/\/signin$/);

  await page.goto("/collections");
  await expect(page).toHaveURL(/\/signin\?next=%2Fcollections$/);
  await submitPassword(page, "wrong-password");
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password" })).toBeVisible();
});

test("a merchant collects, pays out and sees the payout in the ledger", async ({ page, isMobile }) => {
  await signInWithKey(page, TENANT_KEY);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(visible(page, "GHS 9,958.60")).toBeVisible();

  await page.getByRole("link", { name: "Collections", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Collections" })).toBeVisible();
  await expect(visible(page, "Ama Mensah")).toBeVisible();

  await page.getByRole("link", { name: "Payouts", exact: true }).click();
  await page.getByRole("button", { name: "Send money" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Institution").selectOption("GCB");
  await sheet.getByLabel("Account or wallet number").fill("851274680");
  await sheet.getByRole("button", { name: "Check name" }).click();
  await expect(sheet.getByLabel("Account name")).toHaveValue("KOFI BOATENG");
  await sheet.getByLabel("Amount (GHS)").fill("25");
  await sheet.getByLabel("Reference", { exact: true }).fill("E2E payout");
  await sheet.getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: "Send money" }).last().click();
  await expect(sheet.getByText("Payout submitted")).toBeVisible();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(visible(page, "KOFI BOATENG")).toBeVisible();

  // Admin pages stay closed to a merchant key.
  await page.goto("/admin/tenants");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(isMobile !== undefined).toBe(true);
});

test("an admin onboards a tenant, funds it, adds a colleague and approves a refund", async ({ page }) => {
  const code = `E2E${Date.now().toString(36).toUpperCase()}`;
  await signInAsAdmin(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Platform" })).toBeVisible();

  await page.getByRole("link", { name: "Tenants", exact: true }).click();
  await page.getByRole("button", { name: "Add tenant" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Code").fill(code);
  await sheet.getByLabel("Trading name").fill(`Tenant ${code}`);
  await sheet.getByLabel("Registered name").fill(`${code} Ltd`);
  await sheet.getByRole("button", { name: "Create tenant" }).click();

  // The new tenant's key is shown once and must be acknowledged.
  const reveal = page.getByRole("dialog");
  await expect(reveal.getByText(/afk_live_ten-\d+_SECRET/)).toBeVisible();
  await expect(reveal.getByRole("button", { name: "Done" })).toBeDisabled();
  await reveal.getByLabel("I have stored this key").check();
  await reveal.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(/afk_live_/)).toHaveCount(0);

  await visible(page, `Tenant ${code}`).click();
  await page.getByRole("tab", { name: "Wallet" }).click();
  await page.getByRole("button", { name: "Add funds" }).click();
  const topUp = page.getByRole("dialog");
  await topUp.getByLabel("Amount").fill("500");
  await topUp.getByLabel("Reference").fill("DEP-001");
  await topUp.getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: "Add funds" }).last().click();
  await expect(visible(page, "GHS 500.00")).toBeVisible();

  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Add person" }).click();
  const person = page.getByRole("dialog");
  await person.getByLabel("Name").fill("Yaw Owusu");
  await person.getByLabel("Email").fill(`yaw-${code}@afrikob.com`);
  await person.getByLabel("Temporary password").fill("first-password");
  await person.getByRole("button", { name: "Add person" }).click();
  await expect(visible(page, "Yaw Owusu")).toBeVisible();

  await page.goto("/admin/refunds");
  await page.getByRole("button", { name: "Refund actions" }).filter({ visible: true }).first().click();
  await page.getByRole("menuitem", { name: /Approve/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(visible(page, "approved")).toBeVisible();
});

test("a tenant admin requests funds and an Afrikob admin approves them", async ({ page, browser }) => {
  await signInWithPassword(page, TENANT_ADMIN.email, TENANT_ADMIN.password);
  await expect(page).toHaveURL(/\/tenant-admin$/);
  await expect(page.getByRole("heading", { name: "Afikob" })).toBeVisible();

  // Requesting funds does not move money: it queues an approval.
  await page.getByRole("button", { name: /Request funds/ }).click();
  const request = page.getByRole("dialog");
  await request.getByLabel("Amount").fill("2500");
  await request.getByLabel("Reference").fill("DEP-900");
  await request.getByRole("button", { name: "Send request" }).click();
  await expect(visible(page, "waiting in Approvals")).toBeVisible();

  await page.goto("/tenant-admin/approvals");
  await expect(visible(page, "Wallet Topup")).toBeVisible();

  // The platform side is a different person, so a separate session entirely.
  const staff = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "203.0.113.200" } });
  const staffPage = await staff.newPage();
  await signInAsAdmin(staffPage);
  await staffPage.goto("/admin/approvals");
  await staffPage.getByRole("button", { name: "Request actions" }).filter({ visible: true }).first().click();
  await staffPage.getByRole("menuitem", { name: /Approve/ }).click();
  await staffPage.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(visible(staffPage, "approved")).toBeVisible();

  // The approved top-up has been credited to the tenant's wallet.
  await page.goto("/tenant-admin");
  await expect(visible(page, "GHS 12,458.60")).toBeVisible();
  // A password session has no money screens: the gateway refuses those.
  await page.goto("/collections");
  await expect(page).toHaveURL(/\/tenant-admin$/);
  await staff.close();
});

test("an admin downloads a report", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("collections-report.csv");
});

test("a signed-out admin resets their password and signs in with it", async ({ page }) => {
  await page.goto("/signin");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  // Wait for hydration: typing before it lands would leave the form state empty.
  await page.waitForLoadState("networkidle");
  const email = page.getByLabel("Email");
  await email.click();
  await email.pressSequentially(ADMIN.email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText(/We sent a code to o\*\*\*@afrikob.com/)).toBeVisible();

  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("That code is not valid. Check your email or send a new one.")).toBeVisible();

  await page.getByLabel("Code").fill("123456");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("New password").fill("a-brand-new-password");
  await page.getByLabel("Confirm password").fill("a-brand-new-password");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/reason=password-reset/);

  await signInAsAdmin(page, "a-brand-new-password");
  await expect(page).toHaveURL(/\/admin$/);
});

/**
 * A tenant user with only a password reaches no money screens: the gateway
 * refuses a portal session there, so the app says so instead of failing later.
 */
test("a password-only tenant user lands on the dead end, not a broken dashboard", async ({ page }) => {
  await signInWithPassword(page, TENANT_CLERK.email, TENANT_CLERK.password);
  await expect(page).toHaveURL(/\/no-access$/);
  await expect(page.getByText(/API key/i).first()).toBeVisible();
  // Every money destination sends them back here.
  for (const path of ["/dashboard", "/collections", "/disbursements", "/refunds"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/no-access$/);
  }
  // As does the tenant administration area, which is not theirs.
  await page.goto("/tenant-admin");
  await expect(page).toHaveURL(/\/no-access$/);
});

/**
 * A link from anywhere else (email, chat, the hosting console) must open the
 * dashboard already signed in. SameSite=strict silently dropped the session
 * here and showed the sign-in page instead.
 */
test("a link from another site opens the dashboard still signed in", async ({ page, baseURL }) => {
  await signInAsAdmin(page);
  await page.waitForURL(/\/admin$/);

  // 127.0.0.1 and localhost are different sites to the browser, which is all a
  // cross-site arrival needs.
  const elsewhere = baseURL!.replace("localhost", "127.0.0.1");
  await page.goto(elsewhere);
  await page.setContent(`<a id="go" href="${baseURL}/admin">Open the dashboard</a>`);
  await Promise.all([page.waitForNavigation(), page.click("#go")]);

  await expect(page).toHaveURL(/\/admin$/);
});

/** Signing in after being bounced returns you to the page you asked for. */
test("returns you to the page you were trying to open", async ({ page }) => {
  await page.goto("/admin/approvals");
  await expect(page).toHaveURL(/\/signin\?next=%2Fadmin%2Fapprovals$/);

  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("One-time code").fill(LOGIN_CODE);
  await page.getByRole("button", { name: /Verify and sign in/ }).click();

  await expect(page).toHaveURL(/\/admin\/approvals$/);
  await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible();
});
