import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

export interface WorkoutDeleteDialogData {
  readonly title: string;
}

/** Closes with `true` when the user confirms. */
@Component({
  selector: 'app-workout-delete-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title i18n="@@workouts.delete.title">Session löschen</h2>
    <mat-dialog-content>
      <p i18n="@@workouts.delete.confirm">
        „{{ data.title }}“ wirklich löschen? Eingetragene Übungen bleiben
        erhalten.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close i18n="@@workouts.delete.cancel">
        Abbrechen
      </button>
      <button
        mat-flat-button
        color="warn"
        data-testid="workout-delete-confirm"
        (click)="dialogRef.close(true)"
        i18n="@@workouts.delete.button"
      >
        Löschen
      </button>
    </mat-dialog-actions>
  `,
})
export class WorkoutDeleteDialogComponent {
  readonly data = inject<WorkoutDeleteDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(
    MatDialogRef<WorkoutDeleteDialogComponent, boolean>
  );
}
