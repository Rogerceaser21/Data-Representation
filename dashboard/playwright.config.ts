import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Minimal Playwright config for the dashboard Teacher portal OTP spec
 * (dashboard/tests/portal-otp.spec.ts). Serves the repo root over a plain
 * static server, exactly like GitHub Pages, and loads the MASTER
 * (dashboard/src/index.html) directly, never the generated dashboard/index.html.
 *
 * Own port (8126): never 8123/8124/8125, which other worktrees' suites use.
 *
 *   npm install        (once; @playwright/test is the only dependency)
 *   npx playwright test --config=dashboard/playwright.config.ts
 */
const PORT = process.env.DASH_PORT || '8126';
const REPO_ROOT = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    cwd: REPO_ROOT,
    url: `http://127.0.0.1:${PORT}/dashboard/src/index.html`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
