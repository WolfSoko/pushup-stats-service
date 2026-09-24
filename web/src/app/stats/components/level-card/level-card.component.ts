import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { XpStore } from '@pu-stats/data-access-state';
import { SkeletonComponent } from '@pu-stats/ui';

/**
 * Compact level strip on the dashboard: current level, the bar to the
 * next one and how many XP are still missing. One link to the badge
 * collection, where the level badges live.
 */
@Component({
  selector: 'app-level-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
    SkeletonComponent,
  ],
  template: `
    <a
      class="level-card"
      routerLink="/abzeichen"
      data-testid="dashboard-level-card"
      [attr.aria-busy]="loaded() ? null : 'true'"
    >
      <span class="level-badge" aria-hidden="true">
        <mat-icon>bolt</mat-icon>
      </span>
      <span class="level-body">
        @if (loaded()) {
          <span class="level-row">
            <b class="level-title" i18n="@@levelCard.title"
              >Level {{ progress().level }}</b
            >
            <small class="level-total" i18n="@@levelCard.total"
              >{{ progress().totalXp | number }} XP</small
            >
          </span>
          <mat-progress-bar
            mode="determinate"
            [value]="percent()"
            [attr.aria-label]="barLabel()"
          />
          <small class="level-remaining" i18n="@@levelCard.remaining"
            >Noch {{ remaining() | number }} XP bis Level
            {{ progress().level + 1 }}</small
          >
        } @else {
          <pu-skeleton shape="title" width="96px" />
          <pu-skeleton width="100%" />
        }
      </span>
      <mat-icon class="level-cta" aria-hidden="true">chevron_right</mat-icon>
    </a>
  `,
  styles: `
    .level-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      margin: 8px 0 12px;
      border-radius: 16px;
      border: 1px solid rgba(250, 204, 21, 0.35);
      background: linear-gradient(
        120deg,
        rgba(250, 204, 21, 0.14),
        rgba(31, 47, 84, 0.45)
      );
      color: inherit;
      text-decoration: none;
      transition: transform 0.15s ease;

      &:hover,
      &:focus-visible {
        transform: translateY(-1px);
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary, #8fb4ff);
        outline-offset: 3px;
      }
    }

    .level-badge {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      flex: none;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #fde68a, #f59e0b);
      color: #422006;
      box-shadow: 0 0 12px rgba(250, 204, 21, 0.45);
    }

    .level-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .level-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    .level-title {
      font-size: 1rem;
    }

    .level-total,
    .level-remaining {
      font-size: 0.76rem;
      opacity: 0.8;
      font-variant-numeric: tabular-nums;
    }

    .level-cta {
      opacity: 0.6;
    }

    @media (prefers-reduced-motion: reduce) {
      .level-card {
        transition: none;
      }
    }
  `,
})
export class LevelCardComponent {
  private readonly xp = inject(XpStore);

  protected readonly loaded = this.xp.loaded;
  protected readonly progress = this.xp.progress;
  protected readonly percent = computed(() =>
    Math.round(this.progress().fraction * 100)
  );
  protected readonly remaining = computed(
    () => this.progress().levelSpan - this.progress().intoLevel
  );
  protected readonly barLabel = computed(
    () =>
      $localize`:@@levelCard.barLabel:Fortschritt zu Level ${this.progress().level + 1}:next:`
  );
}
