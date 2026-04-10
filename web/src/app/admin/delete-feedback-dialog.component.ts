import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

export interface DeleteFeedbackDialogData {
  name: string | null;
  message: string;
}

@Component({
  selector: 'app-delete-feedback-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title i18n="@@admin.feedback.delete.title">
      Feedback löschen
    </h2>
    <mat-dialog-content>
      <p i18n="@@admin.feedback.delete.confirm">
        Möchtest du dieses Feedback wirklich endgültig löschen?
      </p>
      <p class="feedback-preview">
        <strong>{{ data.name ?? anonymLabel }}</strong>
        <br />
        <span class="feedback-message">{{ preview }}</span>
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close i18n="@@admin.feedback.delete.cancel">
        Abbrechen
      </button>
      <button
        mat-flat-button
        color="warn"
        (click)="confirm()"
        i18n="@@admin.feedback.delete.button"
      >
        Löschen
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .feedback-preview {
      margin-top: 12px;
      padding: 12px;
      background: var(--mat-sys-surface-variant);
      border-radius: 6px;
    }
    .feedback-message {
      font-size: 0.9em;
      white-space: pre-wrap;
      word-break: break-word;
      display: inline-block;
      max-width: 360px;
    }
  `,
})
export class DeleteFeedbackDialogComponent {
  readonly data = inject<DeleteFeedbackDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<DeleteFeedbackDialogComponent, boolean>
  );
  readonly anonymLabel = $localize`:@@admin.feedback.delete.anonym:Anonym`;

  get preview(): string {
    const trimmed = this.data.message.trim();
    return trimmed.length > 200 ? trimmed.slice(0, 200) + '…' : trimmed;
  }

  confirm(): void {
    this.dialogRef.close(true);
  }
}
