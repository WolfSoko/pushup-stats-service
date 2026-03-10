import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  email,
  form,
  FormField,
  minLength,
  required,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MatStepper,
  MatStepperModule,
  StepperOrientation,
} from '@angular/material/stepper';
import { ActivatedRoute, Router } from '@angular/router';
import { map, Observable } from 'rxjs';
import { AuthStore } from '../../core/state/auth.store';
import { RegisterSuccessComponent } from './components/register-success';
import { RegisterUiStore } from './register-ui.store';
@Component({
  selector: 'pus-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatStepperModule,
    FormField,
    RegisterSuccessComponent,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RegisterUiStore],
})
export class RegisterComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly breakpointObserver = inject(BreakpointObserver);
  readonly authState = inject(AuthStore);
  readonly registerUiStore = inject(RegisterUiStore);

  private readonly registerData = signal({
    email: '',
    password: '',
    repeatPassword: '',
  });
  readonly registerForm = form(
    this.registerData,
    ({ email: emailControl, password }) => {
      required(emailControl, {
        message: $localize`:@@validate.email.required:Bitte E-Mail eingeben!`,
      });
      email(emailControl, {
        message: $localize`:@@validate.email.email:Bitte gültige E-Mail eingeben!`,
      });
      required(password, {
        message: $localize`:@@validate.password.required:Bitte Passwort eingeben!`,
      });
      minLength(password, 8, {
        message: $localize`:@@validate.password.minLength:Passwort muss mindestens 8 Zeichen lang sein!`,
      });
    }
  );

  readonly stepperOrientation: Observable<StepperOrientation> =
    this.breakpointObserver
      .observe('(min-width: 800px)')
      .pipe(map(({ matches }) => (matches ? 'horizontal' : 'vertical')));

  togglePasswordVisibility(): void {
    this.registerUiStore.toggleHidePassword();
  }

  async goToLogin(): Promise<void> {
    if (this.authState.isAuthenticated()) await this.authState.logout();
    this.registerUiStore.resetSuccess();
    await this.router.navigateByUrl('/login');
  }

  async completeCredentialStep(stepper: MatStepper): Promise<void> {
    const { email, password, repeatPassword } = this.registerForm().value();
    if (
      !this.registerUiStore.isCredentialStepValid(
        this.registerForm.email().invalid(),
        password,
        repeatPassword
      )
    )
      return;
    await this.registerUiStore.signUpWithEmail(email, password);
    if (this.authState.isAuthenticated()) stepper.next();
  }

  async registerWithGoogle(stepper: MatStepper): Promise<void> {
    if (!(await this.registerUiStore.signInWithGoogle())) return;
    this.registerData.update((v) => ({
      ...v,
      email: this.registerUiStore.prepareGoogleRegistration() || v.email,
    }));
    stepper.selectedIndex = 0;
    stepper.next();
    stepper.next();
  }

  async submitRegistration(): Promise<void> {
    const { email, password, repeatPassword } = this.registerForm().value();
    if (
      !this.registerUiStore.canSubmit(
        this.registerForm.email().invalid(),
        this.registerForm.password().invalid(),
        password,
        repeatPassword
      )
    )
      return;
    if (!this.registerUiStore.isGoogleRegistration()) {
      const signedUp = await this.registerUiStore.signUpWithEmail(
        email,
        password
      );
      if (!signedUp) return;
    }
    await this.registerUiStore.persistProfile();
  }

  async goToDashboard(): Promise<void> {
    await this.router.navigateByUrl(
      this.route.snapshot.queryParamMap.get('returnUrl') ?? '/app'
    );
  }
}
