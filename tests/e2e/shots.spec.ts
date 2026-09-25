import { expect, test, type Page } from "@playwright/test";

/**
 * Layout guard for every signed-in screen at phone, tablet and desktop width:
 * the page never scrolls sideways, and the account menu is opaque and sits
 * above the table beneath it. With SHOT_DIR set it also saves each screen for a
 * human responsive review:
 *   SHOT_DIR=/tmp/shots npx playwright test shots --project=desktop
 */
const OUT = process.env.SHOT_DIR;
const WIDTHS = [390, 768, 1440];
const LOGIN_CODE = "654321";

const ROLES = {
  staff: {
    email: "ops@afrikob.com",
    password: "correct-horse",
    screens: ["/admin", "/admin/tenants", "/admin/reports", "/admin/approvals", "/admin/refunds", "/admin/users"],
  },
  "tenant-admin": {
    email: "owner@afikob.com",
    password: "tenant-horse",
    screens: ["/tenant-admin", "/tenant-admin/people", "/tenant-admin/approvals"],
  },
  tenant: {
    email: "clerk@afikob.com",
    password: "tenant-clerk",
    screens: ["/dashboard", "/collections", "/disbursements", "/disbursements/bulk", "/status-check", "/developers"],
  },
} as const;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("One-time code").fill(LOGIN_CODE);
  await page.getByRole("button", { name: /Verify and sign in/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/signin"));
}

async function expectNoSidewaysScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ request, context }, info) => {
  test.skip(info.project.name !== "desktop", "widths are set explicitly; one browser is enough");
  await request.post("http://localhost:4010/__reset");
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${info.workerIndex + 10}` });
});

test("the sign-in page fits every width", async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: Math.round(width * 1.6) });
    await page.goto("/signin");
    await expectNoSidewaysScroll(page, `/signin at ${width}`);
    if (OUT) await page.screenshot({ path: `${OUT}/signin-${width}.png`, fullPage: true });
  }
});

for (const [role, { email, password, screens }] of Object.entries(ROLES)) {
  test(`${role} screens fit every width`, async ({ page }) => {
    await signIn(page, email, password);
    for (const path of screens) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: Math.round(width * 1.6) });
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expectNoSidewaysScroll(page, `${path} at ${width}`);
        if (OUT) await page.screenshot({ path: `${OUT}/${role}${path.replaceAll("/", "-")}-${width}.png`, fullPage: true });
      }
    }
  });
}

test("the account menu is opaque and sits above the ledger table", async ({ page }) => {
  await signIn(page, ROLES.tenant.email, ROLES.tenant.password);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/collections");
  await expect(page.locator("thead").first()).toBeVisible();

  await page.getByRole("button", { name: "Account" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const background = await menu.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background, "menu background must not be transparent").not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);

  // Whatever lies under the middle of the "Sign out" item must be the menu itself.
  const item = page.getByRole("menuitem", { name: "Sign out" });
  const box = await item.boundingBox();
  expect(box).not.toBeNull();
  const onTop = await page.evaluate(
    ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest("[role=menu]")),
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
  );
  expect(onTop).toBe(true);
  if (OUT) await page.screenshot({ path: `${OUT}/account-menu-1440.png` });
});
