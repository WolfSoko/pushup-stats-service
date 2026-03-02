import { defineConfig, devices } from '@playwright/test';

const apiPort = 4212;
const webPort = 4211;

export default defineConfig({
  testDir: './src',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },

  // Run e2e against `nx serve` in development mode.
  // Angular dev-server provides the /api + /socket.io proxy.
  webServer: [
    {
      command:
        'cd ../data-store && npx firebase emulators:start --only auth,firestore --project pushup-stats',
      url: 'http://127.0.0.1:4000',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
    {
      command: `PORT=${apiPort} npx nx serve api -c development`,
      url: `http://127.0.0.1:${apiPort}/api/health`,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
    {
      command: `API_HOST=127.0.0.1 API_PORT=${apiPort} npx nx serve web -c development-emulator --host=127.0.0.1 --port=${webPort} --proxy-config=web/proxy.e2e.conf.json`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
