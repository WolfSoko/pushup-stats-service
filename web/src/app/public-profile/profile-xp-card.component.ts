import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { levelProgress, type PublicProfileXp } from '@pu-stats/models';

import { formatXp, levelPercent } from '../core/xp/xp-format';

/**
 * Level and XP at the top of a profile, in the gold of an earned badge on
 * the badge page — XP is what every exercise earns, so it leads the
 * profile rather than one exercise's count.
 */
@Component({
  selector: 'app-profile-xp-card',
  imports: [MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="xp-card" data-testid="public-profile-xp">
      <div class="medal" aria-hidden="true">
        <mat-icon>bolt</mat-icon>
        <b>{{ progress().level }}</b>
      </div>
      <div class="body">
        <div class="head">
          <span class="level" i18n="@@publicProfile.xp.level"
            >Level {{ progress().level }}</span
          >
          <ng-content />
        </div>
        <b class="total" data-testid="public-profile-xp-total">{{ total() }}</b>
        <mat-progress-bar
          mode="determinate"
          [value]="percent()"
          [attr.aria-label]="barLabel()"
        />
        <small class="remaining" i18n="@@publicProfile.xp.remaining"
          >Noch {{ remaining() }} bis Level {{ progress().level + 1 }}</small
        >
      </div>
      <ul class="periods">
        <li data-testid="public-profile-xp-week">
          <mat-icon aria-hidden="true">date_range</mat-icon>
          <span i18n="@@publicProfile.xp.week"
            >+{{ weekly() }} diese Woche</span
          >
        </li>
        <li data-testid="public-profile-xp-month">
          <mat-icon aria-hidden="true">calendar_month</mat-icon>
          <span i18n="@@publicProfile.xp.month"
            >+{{ monthly() }} diesen Monat</span
          >
        </li>
      </ul>
    </section>
  `,
  styles: `
    :host {
      display: block;
      border-radius: 20px;
    }

    .xp-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px 16px;
      align-items: center;
      padding: 18px;
      border-radius: 20px;
      border: 1px solid rgba(255, 214, 102, 0.45);
      background:
        radial-gradient(
          circle at 12% 20%,
          rgba(255, 214, 102, 0.3),
          transparent 55%
        ),
        linear-gradient(
          160deg,
          rgba(240, 180, 40, 0.18),
          rgba(178, 110, 10, 0.06)
        );
      color: var(--mat-sys-on-surface);
    }

    .medal {
      position: relative;
      display: grid;
      place-items: center;
      width: 76px;
      height: 76px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #fde68a, #f59e0b);
      color: #422006;
      box-shadow:
        0 0 0 4px rgba(255, 214, 102, 0.25),
        0 0 22px rgba(255, 200, 70, 0.55);

      mat-icon {
        position: absolute;
        top: 6px;
        width: 20px;
        height: 20px;
        font-size: 20px;
        opacity: 0.75;
      }

      b {
        margin-top: 12px;
        font-size: 1.9rem;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
    }

    .body {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 24px;
    }

    .level {
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgb(196, 132, 12);
    }

    .total {
      font-size: 1.9rem;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }

    mat-progress-bar {
      --mat-progress-bar-active-indicator-color: rgb(240, 180, 40);
      --mat-progress-bar-track-color: rgba(240, 180, 40, 0.2);
      border-radius: 999px;
      margin: 4px 0 2px;
    }

    .remaining {
      font-size: 0.78rem;
      color: var(--mat-sys-on-surface-variant);
      font-variant-numeric: tabular-nums;
    }

    .periods {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid rgba(255, 214, 102, 0.4);
        background: rgba(255, 214, 102, 0.12);
        font-size: 0.85rem;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }

      mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
        color: rgb(240, 180, 40);
      }
    }
  `,
})
export class ProfileXpCardComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly xp = input.required<PublicProfileXp>();

  protected readonly progress = computed(() => levelProgress(this.xp().total));
  protected readonly percent = computed(() => levelPercent(this.progress()));
  protected readonly total = computed(() =>
    formatXp(this.progress().totalXp, this.locale)
  );
  protected readonly remaining = computed(() =>
    formatXp(this.progress().levelSpan - this.progress().intoLevel, this.locale)
  );
  protected readonly weekly = computed(() =>
    formatXp(this.xp().weekly, this.locale)
  );
  protected readonly monthly = computed(() =>
    formatXp(this.xp().monthly, this.locale)
  );
  protected readonly barLabel = computed(
    () =>
      $localize`:@@publicProfile.xp.barLabel:Fortschritt zu Level ${this.progress().level + 1}:next:`
  );
}
