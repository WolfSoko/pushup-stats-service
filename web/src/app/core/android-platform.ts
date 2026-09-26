/**
 * Pure device/platform checks for the Android closed-test invite popup.
 * Deliberately plain functions (no DI) so callers pass `navigator.userAgent`
 * / `document.referrer` explicitly and the logic stays trivially testable.
 */

/** True for any Chrome-on-Android-style user agent. */
export function isAndroidDevice(userAgent: string): boolean {
  return /Android/.test(userAgent);
}

/**
 * True when the page is already running inside the installed TWA
 * (Trusted Web Activity) — Bubblewrap wires the launched app to open with
 * `document.referrer` set to `android-app://<package>`, the standard signal
 * used to suppress "install the app" prompts once the app is already
 * installed.
 */
export function isRunningInTwa(referrer: string): boolean {
  return referrer.startsWith('android-app://');
}

export const ANDROID_APP_PACKAGE = 'com.pushupstats.app';

/**
 * Public Play Store listing. `referrer` is Play's install-referrer
 * parameter, so installs can be attributed to the web entry point.
 */
export function playStoreUrl(source: string): string {
  const referrer = encodeURIComponent(`utm_source=web&utm_medium=${source}`);
  return `https://play.google.com/store/apps/details?id=${ANDROID_APP_PACKAGE}&referrer=${referrer}`;
}
