import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import type { AchievementTileView } from './achievement-collection';

@Component({
  selector: 'app-achievement-tile',
  imports: [DatePipe, MatIconModule, MatProgressBarModule, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #content>
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
          >{{
            progress.current // i18n(ph="current")
          }}
          von
          {{
            progress.target // i18n(ph="target")
          }}</span
        >
      }
    </ng-template>

    @if (tile().earnedAt) {
      <button
        type="button"
        class="tile earned"
        data-testid="achievement-tile-open"
        (click)="opened.emit()"
      >
        <ng-container [ngTemplateOutlet]="content" />
      </button>
    } @else {
      <div class="tile" [class.next]="!!tile().progress">
        <ng-container [ngTemplateOutlet]="content" />
      </div>
    }
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
      width: 100%;
      font: inherit;
      cursor: pointer;
      opacity: 1;
      filter: none;
      border: 1px solid rgba(255, 214, 102, 0.45);
      background:
        radial-gradient(
          circle at 50% 20%,
          rgba(255, 214, 102, 0.28),
          transparent 65%
        ),
        linear-gradient(
          160deg,
          rgba(240, 180, 40, 0.18),
          rgba(178, 110, 10, 0.08)
        );
      color: var(--mat-sys-on-surface);
    }

    .tile.earned:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(240, 176, 36, 0.25);
    }

    .tile.earned:focus-visible {
      outline: 2px solid rgb(240, 180, 40);
      outline-offset: 2px;
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
      color: rgb(240, 180, 40);
      filter: drop-shadow(0 0 8px rgba(255, 200, 70, 0.55));
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
  readonly opened = output<void>();
}
