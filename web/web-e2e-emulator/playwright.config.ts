import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

/**
 * `staging` points the same specs at the deployed preview and the real
 * staging Firebase project; the default runs them against the local
 * emulators. See README.md.
 */
const isStaging = process.env['E2E_TARGET'] === 'staging';

/**
 * Set here, in the runner, before any worker exists: workers inherit the
 * environment, so seeding (in a worker) and cleanup (in global setup and
 * teardown) agree on which accounts belong to this run. In CI the
 * workflow passes the GitHub run id instead.
 */
process.env['E2E_RUN_ID'] ??= `local${Date.now().toString(36)}`;

const baseURL =
  process.env['E2E_BASE_URL'] ||
  process.env['E2E_EMULATOR_BASE_URL'] ||
  'http://127.0.0.1:4302';

/**
 * The critical-path suite: the flows that need a real backend, run
 * against the Firebase emulators. See README.md for why this is a
 * separate project from `web/web-e2e`.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './specs' }),
  globalSetup: './support/global-setup.ts',
  globalTeardown: './support/global-teardown.ts',
  use: {
    baseURL,
    /**
     * The specs assert German copy. The dev server builds a single
     * locale and the source locale is German, but the browser locale
     * still decides `LOCALE_ID`-driven formatting, so it is pinned.
     */
    locale: 'de-DE',
    trace: 'on-first-retry',
    /**
     * Without these, a single click or navigation that never becomes
     * actionable waits out the whole test timeout, and Playwright
     * reports "test timeout exceeded" instead of the actionability log
     * that says why the element could not be clicked. One such click
     * cost a 25-minute CI job (2 tests x 3 attempts x 240 s).
     */
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  /**
   * Two servers, both started as Nx tasks so `@nx/playwright/plugin`
   * turns them into `dependsOn` edges and the whole run shares one
   * emulator and one app server. The emulator URL is the hub, which
   * answers with the registry of running emulators — see
   * `support/global-setup.ts`, which waits for all three to appear in it
   * before the first test runs.
   *
   * Against staging there is nothing to start: the app is already
   * deployed and `E2E_BASE_URL` points at it.
   */
  webServer: isStaging
    ? []
    : [
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
  /**
   * A hard ceiling below the CI job's own 30 minutes, so a pathological
   * run ends as a Playwright report naming the tests that hung rather
   * than as a runner kill with no summary at all.
   */
  globalTimeout: 20 * 60 * 1000,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
