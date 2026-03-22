import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { AdminUser } from './admin-page.component';

@Component({
  selector: 'app-delete-user-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title i18n="@@admin.delete.title">Benutzer löschen</h2>
    <mat-dialog-content>
      <p>
        <strong>{{ user.displayName ?? user.uid }}</strong>
        @if (user.email) {
          ({{ user.email }})
        }
      </p>
      <mat-checkbox
        [ngModel]="anonymize()"
        (ngModelChange)="anonymize.set($event)"
      >
        <span i18n="@@admin.delete.anonymize"
          >Daten anonymisieren (Pushups behalten)</span
        >
      </mat-checkbox>
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

  // Default: anonymize for non-anonymous users, hard-delete for anonymous
  readonly anonymize = signal(!this.user.anonymous);

  confirm(): void {
    this.dialogRef.close({ anonymize: this.anonymize() });
  }
}
