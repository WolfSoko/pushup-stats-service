import { defineConfig, devices } from '@playwright/test';

const proxyPort = 4211;
const apiPort = 4212;
const webPort = 4213;

export default defineConfig({
  testDir: './src',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${proxyPort}`,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command:
      'bash -lc "set -euo pipefail; cd ..; ' +
      // Ensure a clean, isolated datastore for each run.
      'mkdir -p tmp/e2e; rm -f tmp/e2e/pushups.db tmp/e2e/user-config.db tmp/e2e/pushups.csv; ' +
      // Build all required dist/ artifacts used by the e2e topology.
      'NODE_OPTIONS=--max-old-space-size=6144 NODE_ENV=production ' +
      'npx nx run-many -t build --projects=web,api,reverse-proxy --configuration=production ' +
      '>/tmp/web-e2e-build.log 2>&1; ' +
      // Start API + SSR web server in the background, then run reverse-proxy in foreground.
      // This matches the real deployment topology: proxy (/:proxyPort) -> api (/:apiPort) + web SSR (/:webPort)
      +`trap 'jobs -p | xargs -r kill' EXIT; ` +
      `NODE_OPTIONS=--max-old-space-size=6144 NODE_ENV=production PORT=${apiPort} WORKSPACE_DIR=$(pwd)/tmp/e2e PUSHUPS_DB_PATH=$(pwd)/tmp/e2e/pushups.db PUSHUPS_CSV_PATH=$(pwd)/tmp/e2e/pushups.csv USER_CONFIG_DB_PATH=$(pwd)/tmp/e2e/user-config.db node dist/api/main.js >/tmp/web-e2e-api.log 2>&1 & ` +
      `NODE_OPTIONS=--max-old-space-size=6144 NODE_ENV=production PORT=${webPort} node dist/web/server/server.mjs >/tmp/web-e2e-ssr.log 2>&1 & ` +
      `HOST=127.0.0.1 PORT=${proxyPort} API_PORT=${apiPort} WEB_PORT=${webPort} node dist/reverse-proxy/main.js"`,
    // Wait for the app HTML to be served (API may start slightly later)
    url: `http://127.0.0.1:${proxyPort}/de`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
