import {
  INSTALL_SUGGESTION_SNOOZE_KEY,
  installSuggestionVariant,
  type InstallSuggestionContext,
  isSnoozed,
  snooze,
} from './install-suggestion';

const browser: InstallSuggestionContext = {
  isInstalled: false,
  isAndroid: false,
  isIos: false,
  canInstallPwa: false,
};

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size;
    },
  };
}

describe('installSuggestionVariant', () => {
  it('should suggest the Play Store app on Android', () => {
    // given
    const context = { ...browser, isAndroid: true, canInstallPwa: true };
    // when
    const variant = installSuggestionVariant(context);
    // then
    expect(variant).toBe('play-store');
  });

  it('should suggest the PWA install when the browser offers it', () => {
    // given
    const context = { ...browser, canInstallPwa: true };
    // when
    const variant = installSuggestionVariant(context);
    // then
    expect(variant).toBe('pwa');
  });

  it('should explain the home-screen steps on iOS', () => {
    // given
    const context = { ...browser, isIos: true };
    // when
    const variant = installSuggestionVariant(context);
    // then
    expect(variant).toBe('ios');
  });

  it('should suggest nothing when the app is already installed', () => {
    // given
    const context = { ...browser, isAndroid: true, isInstalled: true };
    // when
    const variant = installSuggestionVariant(context);
    // then
    expect(variant).toBeNull();
  });

  it('should suggest nothing in a browser without an install path', () => {
    // given
    const context = browser;
    // when
    const variant = installSuggestionVariant(context);
    // then
    expect(variant).toBeNull();
  });
});

describe('install suggestion snooze', () => {
  const now = new Date('2026-09-26T10:00:00.000Z');

  it('should not be snoozed on a fresh device', () => {
    // given
    const storage = memoryStorage();
    // when
    const snoozed = isSnoozed(storage, now);
    // then
    expect(snoozed).toBe(false);
  });

  it('should snooze for 14 days after a dismissal', () => {
    // given
    const storage = memoryStorage();
    // when
    snooze(storage, 'dismissed', now);
    // then
    expect(isSnoozed(storage, new Date('2026-10-10T09:59:00.000Z'))).toBe(true);
    expect(isSnoozed(storage, new Date('2026-10-10T10:01:00.000Z'))).toBe(
      false
    );
  });

  it('should snooze for 90 days after an install attempt', () => {
    // given
    const storage = memoryStorage();
    // when
    snooze(storage, 'installing', now);
    // then
    expect(storage.getItem(INSTALL_SUGGESTION_SNOOZE_KEY)).toBe(
      '2026-12-25T10:00:00.000Z'
    );
  });

  it('should treat unreadable storage as not snoozed', () => {
    // given
    const storage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    } as unknown as Storage;
    // when
    const snoozed = isSnoozed(storage, now);
    // then
    expect(snoozed).toBe(false);
  });

  it('should swallow a failing write', () => {
    // given
    const storage = {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    } as unknown as Storage;
    // when
    const write = () => snooze(storage, 'dismissed', now);
    // then
    expect(write).not.toThrow();
  });
});
