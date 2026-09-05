import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { ShareService } from '../core/share.service';
import type { AchievementBadge } from '../public-profile/achievement-badge';

export interface AchievementDialogData {
  readonly badge: AchievementBadge;
  /**
   * Where the share points. Deliberately the homepage, not the user's
   * profile: the profile is only reachable for opted-in users, and a
   * shared link to a private one is a 404 for the recipient. Opted-in
   * users still share their profile from the profile page itself.
   */
  readonly shareUrl: string;
}

@Component({
  selector: 'app-achievement-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="achievement-dialog">
      <mat-icon class="badge-icon" aria-hidden="true">{{
        data.badge.icon
      }}</mat-icon>
      <h2 mat-dialog-title>{{ headline }}</h2>
      <p class="badge-label">{{ data.badge.label }}</p>
      <div mat-dialog-actions class="actions">
        <button mat-button (click)="close()">{{ closeLabel }}</button>
        <button
          mat-flat-button
          color="primary"
          data-testid="achievement-share"
          (click)="share()"
        >
          <mat-icon>share</mat-icon>
          <span>{{ shareLabel }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .achievement-dialog {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 8px 4px 0;
      }
      .badge-icon {
        --mat-icon-color: var(--mat-sys-primary);
        color: var(--mat-sys-primary);
        font-size: 56px;
        width: 56px;
        height: 56px;
        margin-bottom: 4px;
      }
      .badge-label {
        margin: 0 0 8px;
        font-size: 1.05rem;
        color: var(--mat-sys-on-surface-variant);
      }
      .actions {
        display: flex;
        justify-content: center;
        gap: 8px;
      }
    `,
  ],
})
export class AchievementDialogComponent {
  protected readonly data = inject<AchievementDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AchievementDialogComponent>);
  private readonly shareService = inject(ShareService);

  protected readonly headline = $localize`:@@achievement.dialog.headline:Geschafft!`;
  protected readonly closeLabel = $localize`:@@achievement.dialog.close:Weiter`;
  protected readonly shareLabel = $localize`:@@achievement.dialog.share:Teilen`;

  protected close(): void {
    this.dialogRef.close();
  }

  protected async share(): Promise<void> {
    await this.shareService.share({
      title: $localize`:@@achievement.share.title:Pushup Tracker`,
      text: $localize`:@@achievement.share.text:${this.data.badge.label}:badge: — geschafft! 💪`,
      url: this.data.shareUrl,
    });
    this.dialogRef.close();
  }
}
