import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink, RouterLinkActive } from '@angular/router';

import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../../../server-locale-redirect';
import type { MainNavItem } from './main-nav-items';

interface LanguageOption {
  readonly code: SupportedLocale;
  readonly label: string;
}

/**
 * Language switcher options. Labels are the language's self-name so a
 * speaker of any language can recognise their entry, regardless of the
 * UI's current locale. Hardcoded — these strings are language proper
 * names, not UI copy that needs translation.
 */
const LANGUAGE_OPTIONS: ReadonlyArray<LanguageOption> = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'no', label: 'Norsk' },
  { code: 'zh', label: '中文' },
];

/**
 * Coerce an Angular `LOCALE_ID` (which can arrive as `en-US`, `de-DE`,
 * etc. in dev / test builds) to one of the codes we know how to render.
 * Falls back to the source locale (`de`) when the runtime tag doesn't
 * match any supported language.
 */
export function resolveCurrentLocale(localeId: string): SupportedLocale {
  const lower = localeId.toLowerCase();
  return (
    SUPPORTED_LOCALES.find(
      (code) => lower === code || lower.startsWith(`${code}-`)
    ) ?? 'de'
  );
}

/**
 * The drawer's contents: the same entries as the arc nav — one list feeds
 * both, so a page cannot go missing from one menu — plus the two pages
 * the arc nav has no room for (own profile, settings), and the language
 * picker. Every link asks the shell to close the drawer.
 */
@Component({
  selector: 'app-sidenav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatListModule,
    MatSelectModule,
    NgComponentOutlet,
    RouterLink,
    RouterLinkActive,
  ],
  template: `
    <mat-nav-list>
      @for (item of items(); track item.path) {
        <a
          mat-list-item
          [routerLink]="item.path"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: item.exact === true }"
          (click)="navigate.emit()"
        >
          <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
          <span matListItemTitle
            >{{ item.label }}
            @if (item.badge) {
              <ng-container *ngComponentOutlet="item.badge" />
            }
          </span>
        </a>
      }

      @if (loggedIn()) {
        <mat-divider></mat-divider>
        <a
          mat-list-item
          [routerLink]="profileUrl()"
          routerLinkActive="active"
          data-testid="sidenav-profile"
          (click)="navigate.emit()"
        >
          <mat-icon matListItemIcon>account_circle</mat-icon>
          <span matListItemTitle i18n="@@nav.profile">Profil</span>
        </a>
        <a
          mat-list-item
          routerLink="/settings"
          routerLinkActive="active"
          data-testid="sidenav-settings"
          (click)="navigate.emit()"
        >
          <mat-icon matListItemIcon>settings</mat-icon>
          <span matListItemTitle i18n="@@nav.settings">Einstellungen</span>
        </a>
      }

      <mat-divider></mat-divider>

      <div class="sidenav-language">
        <mat-icon class="sidenav-language-icon">language</mat-icon>
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="sidenav-language-field"
        >
          <mat-label i18n="@@nav.language">Sprache</mat-label>
          <mat-select
            [value]="currentLocale"
            (selectionChange)="setLanguage($event.value)"
          >
            @for (option of languageOptions; track option.code) {
              <mat-option [value]="option.code">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
    </mat-nav-list>
  `,
  styles: `
    .active {
      font-weight: 700;
    }

    .sidenav-language {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
    }

    .sidenav-language-icon {
      flex: 0 0 auto;
      opacity: 0.7;
    }

    .sidenav-language-field {
      flex: 1 1 auto;
      width: 100%;
    }
  `,
})
export class AppSidenavComponent {
  readonly items = input.required<ReadonlyArray<MainNavItem>>();
  readonly loggedIn = input(false);
  /** The signed-in user's own profile page. */
  readonly profileUrl = input('');
  /** A link was followed or the language changed; the drawer should close. */
  readonly navigate = output<void>();

  protected readonly languageOptions = LANGUAGE_OPTIONS;
  /**
   * The currently active locale. `LOCALE_ID` in dev/test builds may
   * arrive as `'en-US'` or another extended tag, so we coerce to the
   * matching short code or fall back to the source locale.
   */
  protected readonly currentLocale: SupportedLocale = resolveCurrentLocale(
    inject(LOCALE_ID)
  );

  setLanguage(lang: SupportedLocale, ev?: Event): void {
    ev?.preventDefault();
    this.navigate.emit();
    const maxAge = 180 * 24 * 60 * 60; // 180 days
    document.cookie = `lang=${encodeURIComponent(lang)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    // Preserve current page path when switching language. Strip any
    // existing locale prefix (one of SUPPORTED_LOCALES) and prepend
    // the new one. The alternation regex is rebuilt from the locale
    // list so adding a locale only requires updating one constant.
    const localesAlt = SUPPORTED_LOCALES.join('|');
    const stripPrefix = new RegExp(`^/(?:${localesAlt})(/|$)`);
    const subPath = window.location.pathname.replace(stripPrefix, '/');
    const suffix = subPath === '/' ? '/' : subPath;
    const prefix = `/${lang}`;
    const target = `${prefix}${suffix}${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }
}
