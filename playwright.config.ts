import { defineConfig, devices } from "@playwright/test";

const APP_PORT = 3100;
const GATEWAY_PORT = 4010;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${APP_PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: `node tests/e2e/mock-gateway.mjs`,
      url: `http://localhost:${GATEWAY_PORT}/health`,
      env: { MOCK_GATEWAY_PORT: String(GATEWAY_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `npx next build && npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/signin`,
      timeout: 240_000,
      env: {
        AFRIKOB_API_URL_TEST: `http://localhost:${GATEWAY_PORT}`,
        SESSION_SECRET: "e2e-session-secret-e2e-session-secret-0000",
        NEXT_TELEMETRY_DISABLED: "1",
        // Keep the E2E build away from the .next a dev server may be using.
        NEXT_DIST_DIR: ".next-e2e",
        // The dev .env.local may point at the real gateway over TLS; these runs
        // talk to the local mock over plain http.
        AFRIKOB_TLS_SERVERNAME: "",
      },
      reuseExistingServer: false,
    },
  ],
});
