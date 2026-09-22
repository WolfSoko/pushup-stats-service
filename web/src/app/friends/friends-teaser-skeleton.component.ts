import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SkeletonComponent } from '@pu-stats/ui';

const NAME_WIDTHS = ['60%', '45%', '70%'];

/** The teaser card's body — standing line and mini board — before the lists arrive. */
@Component({
  selector: 'app-friends-teaser-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  host: { 'aria-busy': 'true', 'data-testid': 'dashboard-friends-loading' },
  template: `
    <pu-skeleton class="standing" width="70%" />
    <ol class="mini-board">
      @for (width of nameWidths; track width) {
        <li>
          <pu-skeleton width="1rem" />
          <pu-skeleton [width]="width" />
          <pu-skeleton width="2.5rem" />
        </li>
      }
    </ol>
  `,
  styles: `
    :host {
      display: block;
    }
    .standing {
      margin-bottom: 8px;
    }
    .mini-board {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 4px;
    }
    .mini-board li {
      display: grid;
      grid-template-columns: 1.5rem 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.04);
    }
    :host-context(.dark-theme) .mini-board li {
      background: rgba(255, 255, 255, 0.05);
    }
  `,
})
export class FriendsTeaserSkeletonComponent {
  protected readonly nameWidths = NAME_WIDTHS;
}
