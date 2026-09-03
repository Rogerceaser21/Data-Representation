import { defineConfig, devices } from '@playwright/test';

/**
 * Minimal Playwright config for the OTP form spec (Assets/OTP/tests/otp.spec.ts).
 * Serves the repo root over a plain static server, exactly like GitHub Pages,
 * so the built artifacts resolve ../R3/lib/ and ../brand/ the way they do live.
 *
 *   npm install        (once; @playwright/test is the only dependency)
 *   npx playwright test
 */
export default defineConfig({
  testDir: './Assets/OTP/tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8123',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'python3 -m http.server 8123 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8123/Assets/OTP/rubric-sp1.json',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
