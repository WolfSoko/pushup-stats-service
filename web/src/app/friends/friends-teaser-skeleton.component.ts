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
  styleUrl: './friends-mini-board.scss',
  styles: `
    :host {
      display: block;
    }
    .standing {
      margin-bottom: 8px;
    }
  `,
})
export class FriendsTeaserSkeletonComponent {
  protected readonly nameWidths = NAME_WIDTHS;
}
