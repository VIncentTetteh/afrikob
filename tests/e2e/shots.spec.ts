import { test, type Page } from "@playwright/test";

/**
 * Not an assertion suite: it captures the screens changed by the money-by-credential
 * rule at three widths in both themes, for a human responsive review.
 * Run with: SHOT_DIR=/tmp/shots npx playwright test shots --project=desktop
 */
const OUT = process.env.SHOT_DIR ?? "test-results/shots";

// A review tool, not a gate: it only runs when a reviewer asks for the images.
test.skip(!process.env.SHOT_DIR, "set SHOT_DIR to capture the responsive review images");
const WIDTHS = [390, 768, 1440];
const LOGIN_CODE = "654321";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("One-time code").fill(LOGIN_CODE);
  await page.getByRole("button", { name: /Verify and sign in/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/signin"));
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript(
    (t) => localStorage.setItem("afk-ui", JSON.stringify({ state: { theme: t }, version: 0 })),
    theme,
  );
}

const SCREENS = [
  ["tenant-admin", "/tenant-admin"],
  ["tenant-admin-people", "/tenant-admin/people"],
  ["tenant-admin-approvals", "/tenant-admin/approvals"],
] as const;

for (const theme of ["light", "dark"] as const) {
  test(`capture ${theme}`, async ({ page }) => {
    await setTheme(page, theme);
    await signIn(page, "owner@afikob.com", "tenant-horse");
    for (const [name, path] of SCREENS) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: Math.round(width * 1.6) });
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.screenshot({ path: `${OUT}/${name}-${width}-${theme}.png`, fullPage: true });
      }
    }
    // The dead end belongs to a tenant user without the admin flag.
    await page.context().clearCookies();
    await signIn(page, "clerk@afikob.com", "tenant-clerk");
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: Math.round(width * 1.6) });
      await page.goto("/no-access");
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${OUT}/no-access-${width}-${theme}.png`, fullPage: true });
    }
  });
}
