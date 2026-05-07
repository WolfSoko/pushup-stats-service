import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InstallPromptService } from './install-prompt.service';

interface BeforeInstallPromptEventStub {
  preventDefault: () => void;
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  platforms: readonly string[];
  type: 'beforeinstallprompt';
}

interface MutableNavigator {
  userAgent?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}

type Listener = (event: Event) => void;

describe('InstallPromptService', () => {
  let listeners: Map<string, Set<Listener>>;
  let originalNavigator: PropertyDescriptor | undefined;
  let originalAddEventListener: typeof globalThis.addEventListener | undefined;
  let originalRemoveEventListener:
    | typeof globalThis.removeEventListener
    | undefined;
  let originalMatchMedia: typeof globalThis.matchMedia | undefined;

  function installEventStubs(): void {
    listeners = new Map();
    globalThis.addEventListener = ((type: string, listener: Listener): void => {
      const set = listeners.get(type) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(type, set);
    }) as typeof globalThis.addEventListener;
    globalThis.removeEventListener = ((
      type: string,
      listener: Listener
    ): void => {
      listeners.get(type)?.delete(listener);
    }) as typeof globalThis.removeEventListener;
  }

  function dispatch(type: string, event: object): void {
    listeners.get(type)?.forEach((l) => l(event as Event));
  }

  function setNavigator(stub: MutableNavigator | null): void {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: stub as unknown as Navigator,
    });
  }

  function setMatchMedia(matches: boolean): void {
    globalThis.matchMedia = ((): MediaQueryList =>
      ({
        matches,
        media: '(display-mode: standalone)',
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof globalThis.matchMedia;
  }

  function makePromptEvent(
    outcome: 'accepted' | 'dismissed' = 'accepted'
  ): BeforeInstallPromptEventStub & { promptCalled: boolean } {
    const event = {
      preventDefault: vitest.fn(),
      prompt: vitest.fn().mockImplementation(async () => {
        event.promptCalled = true;
      }),
      userChoice: Promise.resolve({ outcome, platform: 'web' }),
      platforms: ['web'],
      type: 'beforeinstallprompt' as const,
      promptCalled: false,
    };
    return event;
  }

  function setup(
    platform: 'browser' | 'server' = 'browser'
  ): InstallPromptService {
    vitest.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        InstallPromptService,
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
    return TestBed.inject(InstallPromptService);
  }

  beforeAll(() => {
    originalNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator'
    );
    originalAddEventListener = globalThis.addEventListener;
    originalRemoveEventListener = globalThis.removeEventListener;
    originalMatchMedia = globalThis.matchMedia;
  });

  beforeEach(() => {
    installEventStubs();
    setMatchMedia(false);
    setNavigator({ userAgent: 'Mozilla/5.0', maxTouchPoints: 0 });
  });

  afterAll(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    }
    if (originalAddEventListener) {
      globalThis.addEventListener = originalAddEventListener;
    }
    if (originalRemoveEventListener) {
      globalThis.removeEventListener = originalRemoveEventListener;
    }
    if (originalMatchMedia) {
      globalThis.matchMedia = originalMatchMedia;
    }
  });

  describe('Given the platform is the server', () => {
    it('Then no install prompt is exposed and prompt() returns "unavailable"', async () => {
      const service = setup('server');

      expect(service.canInstall()).toBe(false);
      expect(service.isStandalone()).toBe(false);
      expect(service.isIos).toBe(false);
      expect(await service.prompt()).toBe('unavailable');
    });
  });

  describe('Given a beforeinstallprompt event fires in the browser', () => {
    it('Then canInstall becomes true and prompt() resolves with the outcome', async () => {
      const service = setup('browser');
      const event = makePromptEvent('accepted');

      dispatch('beforeinstallprompt', event);

      expect(service.canInstall()).toBe(true);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);

      const outcome = await service.prompt();

      expect(event.prompt).toHaveBeenCalledTimes(1);
      expect(outcome).toBe('accepted');
      expect(service.canInstall()).toBe(false);
      expect(service.isStandalone()).toBe(true);
    });

    it('Then a dismissed outcome does not flip the standalone flag', async () => {
      const service = setup('browser');
      const event = makePromptEvent('dismissed');

      dispatch('beforeinstallprompt', event);

      const outcome = await service.prompt();

      expect(outcome).toBe('dismissed');
      expect(service.isStandalone()).toBe(false);
    });
  });

  describe('Given prompt() is called without a stored event', () => {
    it('Then it returns "unavailable" and never calls prompt()', async () => {
      const service = setup('browser');

      const outcome = await service.prompt();

      expect(outcome).toBe('unavailable');
    });
  });

  describe('Given the appinstalled event fires', () => {
    it('Then the service marks the app as installed and clears any prompt', () => {
      const service = setup('browser');
      dispatch('beforeinstallprompt', makePromptEvent());

      dispatch('appinstalled', { type: 'appinstalled' });

      expect(service.isStandalone()).toBe(true);
      expect(service.canInstall()).toBe(false);
    });
  });

  describe('Given matchMedia reports display-mode: standalone at construction', () => {
    it('Then isStandalone is true on construction', () => {
      setMatchMedia(true);
      const service = setup('browser');

      expect(service.isStandalone()).toBe(true);
    });
  });

  describe('Given the user agent indicates iPhone', () => {
    it('Then isIos is true', () => {
      setNavigator({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        maxTouchPoints: 5,
      });
      const service = setup('browser');

      expect(service.isIos).toBe(true);
    });
  });

  describe('Given an iPadOS 13+ user agent (Macintosh + touch)', () => {
    it('Then isIos is true', () => {
      setNavigator({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        maxTouchPoints: 5,
      });
      const service = setup('browser');

      expect(service.isIos).toBe(true);
    });
  });

  describe('Given a desktop user agent', () => {
    it('Then isIos is false', () => {
      setNavigator({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        maxTouchPoints: 0,
      });
      const service = setup('browser');

      expect(service.isIos).toBe(false);
    });
  });
});
