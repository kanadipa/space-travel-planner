import { defineConfig, devices } from '@playwright/test';

const WEB_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',

  // The tests share one mission list, so they cannot run in parallel.
  workers: 1,

  reporter: 'list',
  use: { baseURL: WEB_URL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      // The compiled app, not the watcher — this is the artefact that ships.
      command: 'npm run start -w @smp/api',
      url: 'http://localhost:3000/api/spacecraft',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -w @smp/web',
      url: WEB_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
