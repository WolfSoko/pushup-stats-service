import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { AdminUser } from './admin-page.models';

@Component({
  selector: 'app-delete-user-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title i18n="@@admin.delete.title">Benutzer löschen</h2>
    <mat-dialog-content>
      <p>
        <strong>{{ user.displayName ?? user.uid }}</strong>
        @if (user.email) {
          ({{ user.email }})
        }
      </p>
      <p i18n="@@admin.delete.purgeInfo">
        Das Konto und alle zugehörigen Daten werden endgültig gelöscht.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close i18n="@@admin.delete.cancel">
        Abbrechen
      </button>
      <button
        mat-flat-button
        color="warn"
        (click)="confirm()"
        i18n="@@admin.delete.confirm"
      >
        Löschen
      </button>
    </mat-dialog-actions>
  `,
})
export class DeleteUserDialogComponent {
  readonly user = inject<AdminUser>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DeleteUserDialogComponent>);

  confirm(): void {
    this.dialogRef.close(true);
  }
}
