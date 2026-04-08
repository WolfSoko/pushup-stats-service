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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FeedbackDialogData, FeedbackResult } from './feedback.models';

@Component({
  selector: 'app-feedback-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
  ],
  styles: `
    mat-dialog-content {
      display: grid;
      gap: 10px;
    }
    mat-form-field:first-of-type {
      margin-top: 8px;
    }
    .anonymous-row {
      display: flex;
      align-items: center;
    }
  `,
  template: `
    <h2 mat-dialog-title i18n="@@feedback.dialog.title">Feedback geben</h2>

    <mat-dialog-content>
      <div class="anonymous-row">
        <mat-checkbox
          [checked]="anonymous()"
          (change)="onAnonymousChange($event.checked)"
          i18n="@@feedback.dialog.anonymous"
          >Anonym absenden</mat-checkbox
        >
      </div>

      @if (!anonymous()) {
        <mat-form-field appearance="outline">
          <mat-label i18n="@@feedback.dialog.name">Name</mat-label>
          <input
            matInput
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
          />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@feedback.dialog.email"
            >E-Mail (optional)</mat-label
          >
          <input
            matInput
            type="email"
            [ngModel]="email()"
            (ngModelChange)="email.set($event)"
          />
        </mat-form-field>
      }

      <mat-form-field appearance="outline">
        <mat-label i18n="@@feedback.dialog.message">Dein Feedback</mat-label>
        <textarea
          matInput
          rows="5"
          [ngModel]="message()"
          (ngModelChange)="message.set($event)"
          required
        ></textarea>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button type="button" mat-button mat-dialog-close i18n="@@cancel">
        Abbrechen
      </button>
      <button
        type="button"
        mat-flat-button
        [disabled]="!message().trim()"
        (click)="submit()"
        i18n="@@feedback.dialog.submit"
      >
        Absenden
      </button>
    </mat-dialog-actions>
  `,
})
export class FeedbackDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<FeedbackDialogComponent>);
  private readonly data = inject<FeedbackDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });

  readonly name = signal(this.data?.name ?? '');
  readonly email = signal(this.data?.email ?? '');
  readonly message = signal('');
  readonly anonymous = signal(!this.data?.name && !this.data?.email);

  onAnonymousChange(checked: boolean): void {
    this.anonymous.set(checked);
    if (checked) {
      this.name.set('');
      this.email.set('');
    } else {
      this.name.set(this.data?.name ?? '');
      this.email.set(this.data?.email ?? '');
    }
  }

  submit(): void {
    const msg = this.message().trim();
    if (!msg) return;

    const result: FeedbackResult = {
      name: this.anonymous() ? '' : this.name().trim(),
      email: this.anonymous() ? '' : this.email().trim(),
      message: msg,
    };

    this.dialogRef.close(result);
  }
}
