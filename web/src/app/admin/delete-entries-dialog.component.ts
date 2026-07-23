import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

export interface DeleteEntriesDialogData {
  count: number;
}

@Component({
  selector: 'app-delete-entries-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title i18n="@@admin.entries.delete.title">
      Einträge löschen
    </h2>
    <mat-dialog-content>
      <p>{{ confirmText }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close i18n="@@admin.entries.delete.cancel">
        Abbrechen
      </button>
      <button
        mat-flat-button
        color="warn"
        (click)="confirm()"
        i18n="@@admin.entries.delete.button"
      >
        Löschen
      </button>
    </mat-dialog-actions>
  `,
})
export class DeleteEntriesDialogComponent {
  readonly data = inject<DeleteEntriesDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<DeleteEntriesDialogComponent, boolean>
  );

  get confirmText(): string {
    const count = this.data.count;
    return count === 1
      ? $localize`:@@admin.entries.delete.confirmOne:Möchtest du diesen Eintrag wirklich endgültig löschen?`
      : $localize`:@@admin.entries.delete.confirmMany:Möchtest du diese ${count}:count: Einträge wirklich endgültig löschen?`;
  }

  confirm(): void {
    this.dialogRef.close(true);
  }
}
