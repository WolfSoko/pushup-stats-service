import { defineConfig, devices } from '@playwright/test';

const webPort = 4211;
const reuseExistingServer = !process.env['CI'];

export default defineConfig({
  testDir: './src',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },

  // Run e2e against `nx serve` in development mode using Firebase emulators.
  webServer: [
    {
      command:
        'bash -lc \'set -euo pipefail; ROOT=$(pwd); while [ ! -f "$ROOT/nx.json" ] && [ "$ROOT" != "/" ]; do ROOT=$(dirname "$ROOT"); done; cd "$ROOT/data-store"; npx firebase emulators:start --only auth,firestore --project pushup-stats\'',
      url: 'http://127.0.0.1:4000',
      reuseExistingServer,
      timeout: 180_000,
    },
    {
      command: `bash -lc 'set -euo pipefail; ROOT=$(pwd); while [ ! -f "$ROOT/nx.json" ] && [ "$ROOT" != "/" ]; do ROOT=$(dirname "$ROOT"); done; cd "$ROOT"; npx nx serve web -c development-emulator --host=127.0.0.1 --port=${webPort}'`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer,
      timeout: 180_000,
    },
  ],
});
