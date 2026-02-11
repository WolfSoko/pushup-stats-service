import { defineConfig, devices } from '@playwright/test';

const port = 4211;

export default defineConfig({
  testDir: './src',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command:
      'bash -lc "set -euo pipefail; cd ..; mkdir -p tmp/e2e; rm -f tmp/e2e/pushups.db; PORT=4211 WORKSPACE_DIR=$(pwd)/tmp/e2e PUSHUPS_DB_PATH=$(pwd)/tmp/e2e/pushups.db npx nx run web:build:development >/tmp/web-e2e-build.log 2>&1; PORT=4211 WORKSPACE_DIR=$(pwd)/tmp/e2e PUSHUPS_DB_PATH=$(pwd)/tmp/e2e/pushups.db node dist/web/server/server.mjs"',
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
