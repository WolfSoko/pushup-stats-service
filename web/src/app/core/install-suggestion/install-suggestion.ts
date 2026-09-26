/**
 * `play-store` sends Android users to the native app, `pwa` hands over to
 * the browser's own install prompt, `ios` explains "Zum Home-Bildschirm"
 * because Safari has no install API.
 */
export type InstallSuggestionVariant = 'play-store' | 'pwa' | 'ios';

export interface InstallSuggestionContext {
  readonly isInstalled: boolean;
  readonly isAndroid: boolean;
  readonly isIos: boolean;
  readonly canInstallPwa: boolean;
}

export function installSuggestionVariant(
  context: InstallSuggestionContext
): InstallSuggestionVariant | null {
  if (context.isInstalled) return null;
  if (context.isAndroid) return 'play-store';
  if (context.isIos) return 'ios';
  if (context.canInstallPwa) return 'pwa';
  return null;
}

export type InstallSuggestionResult = 'installing' | 'dismissed';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Someone who tapped "install" and came back in the browser anyway either
 * uses both or declined in the store — ask again much later than after a
 * plain "Nicht jetzt".
 */
export const SNOOZE_DAYS: Record<InstallSuggestionResult, number> = {
  dismissed: 14,
  installing: 90,
};

/**
 * Per device on purpose: installing is a property of the device, so an
 * account-wide flag would silence the suggestion on a second phone.
 */
export const INSTALL_SUGGESTION_SNOOZE_KEY = 'pus_install_suggestion_until';

export function isSnoozed(storage: Storage | undefined, now: Date): boolean {
  try {
    const until = storage?.getItem(INSTALL_SUGGESTION_SNOOZE_KEY);
    return !!until && until > now.toISOString();
  } catch {
    return false;
  }
}

export function snooze(
  storage: Storage | undefined,
  result: InstallSuggestionResult,
  now: Date
): void {
  const until = new Date(now.getTime() + SNOOZE_DAYS[result] * DAY_MS);
  try {
    storage?.setItem(INSTALL_SUGGESTION_SNOOZE_KEY, until.toISOString());
  } catch {
    // Private mode or blocked storage: the session guard still keeps the
    // suggestion to once per visit.
  }
}
