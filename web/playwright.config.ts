import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://127.0.0.1:4300';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './web-e2e' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /**
     * The specs assert German copy, and the SSR server picks the locale
     * bundle from `Accept-Language` — without this Playwright's default
     * `en-US` context lands on `/en/` and every text locator misses.
     */
    locale: 'de-DE',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /**
   * `serve-e2e` runs the production SSR bundle — the same
   * `node dist/web/server/server.mjs` App Hosting runs — so the suite
   * exercises the localized, prerendered build instead of a dev server.
   * Nx owns that server, Playwright only attaches to it. Both details
   * below are load-bearing for that:
   *
   * 1. `reuseExistingServer: true` is what makes `@nx/playwright/plugin`
   *    turn this command into a `dependsOn` on `e2e` and every
   *    `e2e-ci--<spec>` target, so Nx starts **one** continuous server
   *    task per run and all atomized specs share it. With it `false` (as
   *    it was in CI) every spec spawned its own `nx serve web`, and the
   *    second one in a process chain died on Nx's `Recursive task
   *    invocation detected` guard.
   * 2. The plugin only recognizes the exact `nx run <project>:<target>`
   *    form — a command carrying flags is never parsed into a task, which
   *    is why port and env live on the `serve-e2e` target instead.
   */
  webServer: {
    command: 'npx nx run web:serve-e2e',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: true,
    cwd: workspaceRoot,
    // `serve-e2e` depends on `build`, so a cold cache means waiting out a
    // full production build (prerender included) before the server comes
    // up. In CI Nx runs that build as part of the task graph and the
    // server is already listening when Playwright checks — this budget
    // only matters when Playwright starts the chain itself.
    timeout: 900_000,
  },
  /* Run all specs in parallel within each file. For sharding across CI machines,
   * split by spec file using `--shard=1/N` CLI flag — each shard receives a
   * deterministic subset of files and runs them with the worker count below. */
  fullyParallel: true,
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
