import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { XpStore } from '@pu-stats/data-access-state';
import { xpRateLabelFor } from './xp-rate-label';

/**
 * Pill with an exercise's XP rate ("3 XP / Wdh."). Server-rendered pages
 * see the shipped default — the admin overrides only load in the browser
 * and replace it after hydration, so prerendered HTML never disagrees
 * with the first client render.
 */
@Component({
  selector: 'app-xp-rate-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    @if (label(); as text) {
      <span
        class="xp-rate-badge"
        data-testid="xp-rate-badge"
        matTooltip="Punkte, die diese Übung pro Einheit bringt"
        i18n-matTooltip="@@xp.rate.badgeTooltip"
      >
        <mat-icon aria-hidden="true">bolt</mat-icon>
        {{ text }}
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .xp-rate-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0.2rem 0.6rem 0.2rem 0.4rem;
      border-radius: 999px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
      font: var(--mat-sys-label-medium);
      white-space: nowrap;
    }
    .xp-rate-badge mat-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
    }
  `,
})
export class XpRateBadgeComponent {
  private readonly store = inject(XpStore);
  private readonly locale = inject(LOCALE_ID) as string;

  readonly exerciseId = input.required<string>();

  readonly label = computed(() =>
    xpRateLabelFor(this.exerciseId(), this.store.config(), this.locale)
  );
}
