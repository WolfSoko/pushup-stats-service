import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-logout-all-devices-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title i18n="@@logoutAll.dialog.title">
      Auf allen Geräten abmelden?
    </h2>
    <mat-dialog-content>
      <p i18n="@@logoutAll.dialog.body">
        Du wirst auf diesem und allen anderen Geräten abgemeldet. Push-Abos
        werden entfernt – andere Sitzungen werden spätestens nach einer Stunde
        ungültig.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close i18n="@@logoutAll.dialog.cancel">
        Abbrechen
      </button>
      <button
        mat-flat-button
        color="warn"
        (click)="confirm()"
        i18n="@@logoutAll.dialog.confirm"
      >
        Abmelden
      </button>
    </mat-dialog-actions>
  `,
})
export class LogoutAllDevicesDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<LogoutAllDevicesDialogComponent, boolean>
  );

  confirm(): void {
    this.dialogRef.close(true);
  }
}
