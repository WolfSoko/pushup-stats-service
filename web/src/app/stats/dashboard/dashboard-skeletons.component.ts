import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SkeletonComponent } from '@pu-stats/ui';

/** Stand-in for the analysis teaser card until its deferred chunk renders. */
@Component({
  selector: 'app-analysis-teaser-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, SkeletonComponent],
  host: { 'aria-busy': 'true' },
  template: `
    <mat-card class="teaser-card">
      <mat-card-header>
        <mat-card-title>
          <pu-skeleton shape="title" width="6em" />
        </mat-card-title>
        <mat-card-subtitle>
          <pu-skeleton width="14em" />
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <pu-skeleton shape="rect" height="220px" />
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }
    mat-card-content {
      padding-top: 12px;
    }
  `,
})
export class AnalysisTeaserSkeletonComponent {}

/** Three tile placeholders in the "Letzte Übungen" grid while entries load. */
@Component({
  selector: 'app-recent-exercises-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, SkeletonComponent],
  host: { 'aria-busy': 'true' },
  template: `
    @for (tile of tiles; track tile) {
      <mat-card>
        <mat-card-content>
          <div class="tile-body">
            <pu-skeleton width="70%" />
            <pu-skeleton shape="title" width="3em" />
            <pu-skeleton width="50%" height="0.75em" />
          </div>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 10px;
    }
    .tile-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 4px 0;
    }
  `,
})
export class RecentExercisesSkeletonComponent {
  protected readonly tiles = [0, 1, 2];
}
