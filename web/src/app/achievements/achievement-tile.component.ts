import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import type { AchievementTileView } from './achievement-collection';

@Component({
  selector: 'app-achievement-tile',
  imports: [DatePipe, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="tile"
      [class.earned]="tile().earnedAt"
      [class.next]="!!tile().progress"
    >
      <mat-icon>{{ tile().icon }}</mat-icon>
      <span class="label">{{ tile().label }}</span>

      @if (tile().earnedAt; as awardedAt) {
        <span class="meta">{{ awardedAt | date: 'mediumDate' }}</span>
      } @else if (tile().progress; as progress) {
        <mat-progress-bar
          mode="determinate"
          [value]="(progress.current / progress.target) * 100"
        />
        <span class="meta" i18n="@@achievements.tile.progress"
          >{{ progress.current }}:current: von
          {{ progress.target }}:target:</span
        >
      }
    </div>
  `,
  styles: `
    .tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 16px 12px;
      border-radius: 14px;
      text-align: center;
      /* Locked badges stay visible, just drained of colour: an empty slot
         you can see pulls harder than one you cannot. */
      background: color-mix(
        in srgb,
        var(--mat-sys-surface-variant) 55%,
        transparent
      );
      color: var(--mat-sys-on-surface-variant);
      opacity: 0.6;
      filter: grayscale(1);
      transition:
        opacity 160ms ease,
        filter 160ms ease,
        transform 160ms ease;
    }

    .tile.earned {
      opacity: 1;
      filter: none;
      background: color-mix(in srgb, var(--mat-sys-primary) 14%, transparent);
      color: var(--mat-sys-on-surface);
    }

    .tile.next {
      opacity: 1;
      filter: none;
      outline: 2px dashed
        color-mix(in srgb, var(--mat-sys-primary) 55%, transparent);
    }

    mat-icon {
      --mat-icon-color: currentColor;
      width: 40px;
      height: 40px;
      font-size: 40px;
    }

    .tile.earned mat-icon {
      color: var(--mat-sys-primary);
    }

    .label {
      font-weight: 500;
      line-height: 1.25;
    }

    .meta {
      font-size: 0.75rem;
      opacity: 0.8;
    }

    mat-progress-bar {
      width: 100%;
    }
  `,
})
export class AchievementTileComponent {
  readonly tile = input.required<AchievementTileView>();
}
