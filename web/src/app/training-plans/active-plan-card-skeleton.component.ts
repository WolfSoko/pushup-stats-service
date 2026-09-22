import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SkeletonComponent } from '@pu-stats/ui';

/** The active-plan card's shape while the user's plan is still loading. */
@Component({
  selector: 'app-active-plan-card-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, SkeletonComponent],
  template: `
    <mat-card
      class="active-plan"
      aria-busy="true"
      data-testid="active-plan-loading"
    >
      <mat-card-header>
        <mat-card-title
          ><pu-skeleton shape="title" width="35%"
        /></mat-card-title>
        <mat-card-subtitle><pu-skeleton width="55%" /></mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <pu-skeleton lines="2" />
        <div class="progress-row"><pu-skeleton width="30%" /></div>
        <pu-skeleton shape="rect" height="4px" />
      </mat-card-content>
      <mat-card-actions align="end">
        <pu-skeleton shape="rect" width="140px" height="40px" />
        <pu-skeleton shape="rect" width="160px" height="40px" />
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    .active-plan {
      margin-bottom: 24px;
      border-left: 4px solid var(--mat-sys-primary, #3f51b5);
    }
    mat-card-subtitle {
      margin-top: 6px;
    }
    mat-card-content {
      padding-top: 12px;
    }
    .progress-row {
      margin: 12px 0 8px;
    }
    mat-card-actions {
      gap: 8px;
    }
  `,
})
export class ActivePlanCardSkeletonComponent {}
