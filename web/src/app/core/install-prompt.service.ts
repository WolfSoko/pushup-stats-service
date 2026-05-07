import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type IosNavigator = Navigator & { standalone?: boolean };

export type InstallPromptOutcome =
  | 'accepted'
  | 'dismissed'
  | 'unavailable'
  | 'failed';

@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly deferredPrompt = signal<BeforeInstallPromptEvent | null>(
    null
  );
  private readonly installed = signal<boolean>(this.detectStandalone());

  readonly canInstall = computed(() => this.deferredPrompt() !== null);
  readonly isStandalone = this.installed.asReadonly();
  readonly isIos = this.detectIos();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const onBeforeInstallPrompt = (event: Event): void => {
      event.preventDefault();
      this.deferredPrompt.set(event as BeforeInstallPromptEvent);
    };
    const onInstalled = (): void => {
      this.deferredPrompt.set(null);
      this.installed.set(true);
    };

    globalThis.addEventListener?.('beforeinstallprompt', onBeforeInstallPrompt);
    globalThis.addEventListener?.('appinstalled', onInstalled);

    this.destroyRef.onDestroy(() => {
      globalThis.removeEventListener?.(
        'beforeinstallprompt',
        onBeforeInstallPrompt
      );
      globalThis.removeEventListener?.('appinstalled', onInstalled);
    });
  }

  async prompt(): Promise<InstallPromptOutcome> {
    const event = this.deferredPrompt();
    if (!event) return 'unavailable';

    try {
      await event.prompt();
      const choice = await event.userChoice;
      this.deferredPrompt.set(null);
      if (choice.outcome === 'accepted') {
        this.installed.set(true);
      }
      return choice.outcome;
    } catch {
      this.deferredPrompt.set(null);
      return 'failed';
    }
  }

  private detectStandalone(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    if (typeof globalThis.matchMedia === 'function') {
      try {
        // Call via globalThis so the WebIDL `this` binding is preserved
        // (detached invocation throws "Illegal invocation" in real browsers).
        if (globalThis.matchMedia('(display-mode: standalone)').matches) {
          return true;
        }
      } catch {
        // matchMedia exists but threw — treat as not standalone.
      }
    }
    const nav = globalThis.navigator as IosNavigator | undefined;
    return nav?.standalone === true;
  }

  private detectIos(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    const ua = globalThis.navigator?.userAgent ?? '';
    if (!ua) return false;
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ reports as Mac with touch support.
    const nav = globalThis.navigator as Navigator | undefined;
    return (
      ua.includes('Macintosh') &&
      typeof nav?.maxTouchPoints === 'number' &&
      nav.maxTouchPoints > 1
    );
  }
}
