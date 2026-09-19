import { TARGET, waitForEmulators } from './backend';
import { cleanupStagingData } from './cleanup';

/**
 * Against the emulators: Playwright's `webServer` waits for the emulator
 * hub, which answers before the emulators behind it have registered, and
 * every spec needs Auth, Firestore and Functions.
 *
 * Against staging: nothing to boot, but the residue of any run that
 * crashed before its own teardown is swept first, so a project that has
 * collected junk heals on the next run instead of accumulating.
 */
export default async function globalSetup(): Promise<void> {
  if (TARGET === 'emulator') {
    await waitForEmulators();
    return;
  }
  await cleanupStagingData();
}
