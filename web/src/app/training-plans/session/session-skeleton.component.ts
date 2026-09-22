import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SkeletonComponent } from '@pu-stats/ui';

/** The session card's shape while the plan or workout is still on its way. */
@Component({
  selector: 'app-session-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, SkeletonComponent],
  template: `
    <mat-card
      class="session-card"
      aria-busy="true"
      data-testid="session-loading"
    >
      <p class="pu-visually-hidden" role="status" i18n="@@session.loading">
        Session wird geladen …
      </p>
      <pu-skeleton shape="rect" height="4px" />
      <div class="step">
        <pu-skeleton width="40%" />
        <pu-skeleton shape="title" width="60%" />
        <pu-skeleton shape="rect" width="120px" height="56px" />
        <div class="actions">
          <pu-skeleton shape="rect" width="180px" height="40px" />
          <pu-skeleton shape="rect" width="140px" height="40px" />
        </div>
      </div>
    </mat-card>
  `,
  styles: `
    .session-card {
      padding: 16px;
    }
    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px 0 8px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
    }
  `,
})
export class SessionSkeletonComponent {}
