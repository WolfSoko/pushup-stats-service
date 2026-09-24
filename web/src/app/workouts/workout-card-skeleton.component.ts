import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SkeletonComponent } from '@pu-stats/ui';

/** A workout card's shape while the list has not delivered yet. */
@Component({
  selector: 'app-workout-card-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, SkeletonComponent],
  template: `
    <mat-card class="workout-card">
      <mat-card-header>
        <mat-card-title
          ><pu-skeleton shape="title" width="55%"
        /></mat-card-title>
        <mat-card-subtitle><pu-skeleton width="70%" /></mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <pu-skeleton lines="2" />
      </mat-card-content>
      <mat-card-actions class="actions">
        <pu-skeleton shape="rect" width="112px" height="40px" />
        <pu-skeleton shape="rect" width="136px" height="40px" />
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    mat-card-subtitle {
      margin-top: 6px;
    }
    mat-card-content {
      padding-top: 12px;
    }
    .actions {
      display: flex;
      gap: 8px;
      padding: 8px 16px 16px;
    }
  `,
})
export class WorkoutCardSkeletonComponent {}
