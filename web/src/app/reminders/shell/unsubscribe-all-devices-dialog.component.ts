import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-unsubscribe-all-devices-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title i18n="@@unsubAll.dialog.title">
      Push-Abos aller Geräte entfernen?
    </h2>
    <mat-dialog-content>
      <p i18n="@@unsubAll.dialog.body">
        Alle Push-Benachrichtigungs-Abos auf diesem und allen anderen Geräten
        werden entfernt. Du bleibst angemeldet und kannst Push jederzeit wieder
        aktivieren.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close i18n="@@unsubAll.dialog.cancel">
        Abbrechen
      </button>
      <button
        mat-flat-button
        color="warn"
        (click)="confirm()"
        i18n="@@unsubAll.dialog.confirm"
      >
        Abos entfernen
      </button>
    </mat-dialog-actions>
  `,
})
export class UnsubscribeAllDevicesDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<UnsubscribeAllDevicesDialogComponent, boolean>
  );

  confirm(): void {
    this.dialogRef.close(true);
  }
}
