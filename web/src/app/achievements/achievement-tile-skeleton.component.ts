import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SkeletonComponent } from '@pu-stats/ui';

/** Reserves one badge tile's footprint while the collection loads. */
@Component({
  selector: 'app-achievement-tile-skeleton',
  imports: [SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="tile">
      <pu-skeleton shape="circle" />
      <pu-skeleton width="70%" />
      <pu-skeleton width="45%" height="0.75em" />
      <pu-skeleton shape="rect" height="4px" />
    </div>
  `,
  styles: `
    .tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px 12px;
      border-radius: 14px;
      background: color-mix(
        in srgb,
        var(--mat-sys-surface-variant) 35%,
        transparent
      );
    }
  `,
})
export class AchievementTileSkeletonComponent {}
