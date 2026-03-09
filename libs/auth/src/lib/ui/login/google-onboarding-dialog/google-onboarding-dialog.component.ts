import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { LoginUiStore } from '../login-ui.store';

@Component({
  selector: 'pus-google-onboarding-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
  ],
  templateUrl: './google-onboarding-dialog.component.html',
  styleUrl: './google-onboarding-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleOnboardingDialogComponent {
  readonly loginUiStore = inject(LoginUiStore);
  private readonly dialogRef = inject(
    MatDialogRef<GoogleOnboardingDialogComponent>
  );

  async finish(): Promise<void> {
    const completed = await this.loginUiStore.completeGoogleOnboarding();
    if (completed) this.dialogRef.close('completed');
  }
}
