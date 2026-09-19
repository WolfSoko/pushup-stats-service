import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['E2E_EMULATOR_BASE_URL'] || 'http://127.0.0.1:4302';

/**
 * The critical-path suite: the flows that need a real backend, run
 * against the Firebase emulators. See README.md for why this is a
 * separate project from `web/web-e2e`.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './specs' }),
  globalSetup: './support/global-setup.ts',
  use: {
    baseURL,
    /**
     * The specs assert German copy. The dev server builds a single
     * locale and the source locale is German, but the browser locale
     * still decides `LOCALE_ID`-driven formatting, so it is pinned.
     */
    locale: 'de-DE',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  /**
   * Two servers, both started as Nx tasks so `@nx/playwright/plugin`
   * turns them into `dependsOn` edges and the whole run shares one
   * emulator and one app server. The emulator URL is the hub, which
   * answers with the registry of running emulators — see
   * `support/global-setup.ts`, which waits for all three to appear in it
   * before the first test runs.
   */
  webServer: [
    {
      command: 'npx nx run data-store:serve-e2e',
      url: 'http://127.0.0.1:4400/emulators',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 300_000,
    },
    {
      command: 'npx nx run web:serve-e2e-emulator',
      url: baseURL,
      reuseExistingServer: true,
      cwd: workspaceRoot,
      // A cold Angular build of the whole app, ahead of the first test.
      timeout: 900_000,
    },
  ],
  /**
   * One worker on purpose. The specs share one Functions emulator, whose
   * callables are what every friends assertion goes through, and a
   * second worker buys little on a four-spec suite while making a
   * timeout hard to attribute.
   */
  fullyParallel: false,
  workers: 1,
  /**
   * Above the sum of the per-step budgets in the heaviest spec (the
   * friends ones chain two sign-ins, an invite round trip and several
   * list reloads, ~235 s of budget for a path that normally takes 13 s).
   * Under that sum the test timeout fires first and the report says only
   * that the test was too slow, instead of naming the step that hung.
   */
  timeout: 240_000,
  retries: process.env['CI'] ? 2 : 0,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
