import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { AchievementKind } from '@pu-stats/models';
import { SkeletonComponent } from '@pu-stats/ui';

import { AchievementCelebrationService } from './achievement-celebration.service';
import { AchievementTileComponent } from './achievement-tile.component';
import { AchievementTileSkeletonComponent } from './achievement-tile-skeleton.component';
import { AchievementsStore } from './achievements.store';

const SKELETON_TILES = [0, 1, 2, 3, 4, 5];

@Component({
  selector: 'app-achievements-page',
  imports: [
    AchievementTileComponent,
    AchievementTileSkeletonComponent,
    SkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" [attr.aria-busy]="store.loading() ? true : null">
      <header>
        <h1 i18n="@@achievements.page.title">Deine Abzeichen</h1>
        @if (store.loading()) {
          <pu-skeleton class="count" width="180px" />
        } @else {
          <p class="count" i18n="@@achievements.page.count">
            {{
              store.collection().earnedCount // i18n(ph="earned")
            }}
            von
            {{
              store.collection().totalCount // i18n(ph="total")
            }}
            freigeschaltet
          </p>
        }
      </header>

      @if (store.loading()) {
        <div class="next">
          <pu-skeleton width="96px" />
          <app-achievement-tile-skeleton />
        </div>
        <section class="group">
          <pu-skeleton shape="title" width="160px" class="group-title" />
          <div class="grid">
            @for (tile of skeletonTiles; track tile) {
              <app-achievement-tile-skeleton />
            }
          </div>
        </section>
      }

      @if (store.collection().next; as next) {
        <div class="next">
          <span i18n="@@achievements.page.next">Als Nächstes</span>
          <app-achievement-tile [tile]="next" />
        </div>
      }

      @for (group of store.collection().groups; track group.kind) {
        <section class="group">
          <h2>{{ groupTitle(group.kind) }}</h2>
          <div class="grid">
            @for (tile of group.tiles; track tile.id) {
              <app-achievement-tile
                [tile]="tile"
                (opened)="celebration.show(tile)"
              />
            }
          </div>
        </section>
      }
    </section>
  `,
  styles: `
    .page {
      max-width: 960px;
      margin: 0 auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    h1 {
      margin: 0 0 4px;
    }

    .count {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .next {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }

    .next > span {
      font-weight: 600;
      color: var(--mat-sys-primary);
    }

    .next app-achievement-tile,
    .next app-achievement-tile-skeleton {
      width: min(220px, 100%);
    }

    .group h2 {
      font-size: 1.05rem;
      margin: 0 0 12px;
    }

    .group-title {
      margin-bottom: 12px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
    }
  `,
})
export class AchievementsPageComponent {
  protected readonly store = inject(AchievementsStore);
  protected readonly celebration = inject(AchievementCelebrationService);
  protected readonly skeletonTiles = SKELETON_TILES;

  protected groupTitle(kind: AchievementKind): string {
    if (kind === 'plan-days') {
      return $localize`:@@achievements.group.planDays:Trainingstage`;
    }
    if (kind === 'plan-completed') {
      return $localize`:@@achievements.group.planCompleted:Abgeschlossene Pläne`;
    }
    return $localize`:@@achievements.group.invites:Eingeladene Freunde`;
  }
}
