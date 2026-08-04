import { defineConfig, devices } from '@playwright/test';
import { API_PORT, API_URL, E2E_DATABASE_URL, WEB_PORT, WEB_URL } from './e2e/config';

/**
 * The only layer that runs the real thing end to end: a real browser, the built
 * API, and a real Postgres.
 *
 * The unit and integration suites deliberately avoid a database so `npm test`
 * needs no Docker. The cost of that is they cannot catch a mismatch between the
 * code and the actual schema — every `String[]` and `Json` column here is
 * written and read back through Prisma against migrated tables.
 *
 * Run with `npm run test:e2e`. Requires `docker compose up -d`.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',

  // A shared database makes parallel writes to the mission list order-dependent.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],

  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      // The compiled app, not the watcher — this is the artefact that ships.
      command: 'npm run start -w @smp/api',
      url: `${API_URL}/api/spacecraft`,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        PORT: String(API_PORT),
        WEB_ORIGIN: WEB_URL,
      },
    },
    {
      command: `npm run dev -w @smp/web -- --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
      // Points the dev server's /api proxy at this run's API rather than :3000.
      env: { API_URL },
    },
  ],
});
