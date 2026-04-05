import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AdsStore } from './ads.store';
import { ANALYTICS_CONSENT_KEY, COOKIE_CONSENT_KEY } from './consent.constants';

export type CookieConsentChoice = 'all' | 'necessary' | null;

function readConsent(): CookieConsentChoice {
  try {
    if (typeof globalThis.localStorage === 'undefined') return null;
    const value = globalThis.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (value === 'all' || value === 'necessary') return value;
  } catch {
    /* storage blocked (e.g. private browsing) */
  }
  return null;
}

function writeConsent(choice: 'all' | 'necessary'): void {
  try {
    if (typeof globalThis.localStorage === 'undefined') return;
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  } catch {
    /* storage blocked */
  }
}

@Component({
  selector: 'lib-cookie-consent-banner',
  imports: [MatButtonModule, RouterLink],
  template: `
    @if (visible()) {
      <div
        class="consent-banner"
        role="dialog"
        aria-label="Cookie-Einstellungen"
        i18n-aria-label="@@consent.banner.aria"
      >
        <p i18n="@@consent.banner.text">
          Wir verwenden Cookies f&uuml;r die Funktion der Website.
          Zus&auml;tzlich nutzen wir Google Analytics und Google AdSense. Sie
          k&ouml;nnen w&auml;hlen, ob Sie personalisierte Werbung und Analyse
          zulassen m&ouml;chten.
        </p>
        <div class="consent-actions">
          <button
            mat-flat-button
            color="primary"
            (click)="accept('all')"
            i18n="@@consent.banner.acceptAll"
          >
            Alle akzeptieren
          </button>
          <button
            mat-stroked-button
            (click)="accept('necessary')"
            i18n="@@consent.banner.necessaryOnly"
          >
            Nur notwendige
          </button>
        </div>
        <p class="consent-hint">
          <a routerLink="/datenschutz" i18n="@@consent.banner.privacyLink"
            >Mehr in unserer Datenschutzerkl&auml;rung</a
          >
        </p>
      </div>
    }
  `,
  styles: `
    .consent-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      padding: 16px 24px;
      background: var(--mat-app-surface, #1e1e1e);
      color: var(--mat-app-on-surface, #fff);
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
    }

    :host-context(html.light-theme) .consent-banner {
      background: #ffffff;
      color: #1e293b;
      border-top-color: rgba(148, 163, 184, 0.3);
      box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
    }

    p {
      margin: 0 0 12px;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .consent-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .consent-hint {
      margin-top: 8px;
      margin-bottom: 0;
      font-size: 0.8rem;
      opacity: 0.7;

      a {
        color: inherit;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookieConsentBannerComponent {
  private readonly adsStore = inject(AdsStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly choice = signal<CookieConsentChoice>(readConsent());

  /** Only show in browser – on SSR localStorage is unavailable. */
  readonly visible = computed(() => this.isBrowser && this.choice() === null);

  /** Re-show the banner so the user can change their consent. */
  reopen(): void {
    this.choice.set(null);
  }

  accept(choice: 'all' | 'necessary'): void {
    writeConsent(choice);
    this.choice.set(choice);

    // Update ads store: targeted ads only when user accepts all
    this.adsStore.setTargetedAdsConsent(choice === 'all');

    // Update analytics consent
    try {
      if (typeof globalThis.localStorage !== 'undefined') {
        globalThis.localStorage.setItem(
          ANALYTICS_CONSENT_KEY,
          choice === 'all' ? 'granted' : 'denied'
        );
      }
    } catch {
      /* storage blocked */
    }
  }
}
