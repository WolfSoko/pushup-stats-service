import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SkeletonComponent } from '@pu-stats/ui';

const STAT_CARDS = [0, 1, 2, 3];
const SECTIONS = [0, 1];

/** Reserves the profile page's footprint while the profile document loads. */
@Component({
  selector: 'app-public-profile-skeleton',
  imports: [SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="header">
      <pu-skeleton shape="circle" width="72px" height="72px" />
      <div class="header-text">
        <pu-skeleton shape="title" width="45%" />
        <pu-skeleton width="70%" />
        <pu-skeleton width="55%" />
      </div>
    </div>
    <div class="stats">
      @for (card of statCards; track card) {
        <div class="stat">
          <pu-skeleton width="50%" height="0.75em" />
          <pu-skeleton shape="title" width="35%" height="1.6rem" />
        </div>
      }
    </div>
    @for (section of sections; track section) {
      <div class="section">
        <pu-skeleton shape="title" width="30%" />
        <pu-skeleton shape="rect" height="96px" />
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: clamp(16px, 2vw, 24px);
      border-radius: 20px;
      background: color-mix(
        in srgb,
        var(--mat-sys-surface-variant) 35%,
        transparent
      );
    }
    .header-text {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .stats {
      display: grid;
      gap: 12px;
      margin-top: 20px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
    .stat {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px;
      border-radius: 12px;
      background: color-mix(
        in srgb,
        var(--mat-sys-surface-variant) 35%,
        transparent
      );
    }
    .section {
      margin-top: 28px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `,
})
export class PublicProfileSkeletonComponent {
  protected readonly statCards = STAT_CARDS;
  protected readonly sections = SECTIONS;
}
