import { waitForEmulators } from './emulator';

/**
 * Playwright's `webServer` waits for the emulator hub, which answers
 * before the emulators behind it have registered. Every spec here needs
 * Auth, Firestore and Functions, so the run waits for all three rather
 * than letting the first spec discover it by timing out.
 */
export default async function globalSetup(): Promise<void> {
  await waitForEmulators();
}
