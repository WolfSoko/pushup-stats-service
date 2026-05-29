import { StepperSelectionEvent } from '@angular/cdk/stepper';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  email,
  form,
  FormField,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { hasStrongPasswordPolicy } from '../password-policy';
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
import {
  RegistrationAnalyticsService,
  REGISTRATION_STEPS,
  RegistrationStep,
} from '../../core/registration-analytics.service';
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
export class RegisterComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly analytics = inject(RegistrationAnalyticsService);
  readonly authState = inject(AuthStore);
  readonly registerUiStore = inject(RegisterUiStore);

  readonly selectedPlanTitle = computed(
    () => this.registerUiStore.selectedPlan()?.title ?? null
  );

  private currentStepIndex = 0;

  ngOnInit(): void {
    const planId = this.route.snapshot.queryParamMap.get('planId');
    if (planId) {
      this.registerUiStore.setSelectedPlanId(planId);
    }
    this.analytics.trackStarted({
      plan_preselected: this.registerUiStore.selectedPlan() !== null,
    });
    this.analytics.trackStepView('email', { is_google: false });
  }

  ngOnDestroy(): void {
    if (this.registerUiStore.registerSuccess()) return;
    const lastStep = REGISTRATION_STEPS[this.currentStepIndex] ?? 'email';
    this.analytics.trackAbandoned({
      last_step: lastStep,
      is_google: this.registerUiStore.isGoogleRegistration(),
    });
  }

  onStepperSelectionChange(event: StepperSelectionEvent): void {
    const isGoogle = this.registerUiStore.isGoogleRegistration();
    const previous: RegistrationStep | undefined =
      REGISTRATION_STEPS[event.previouslySelectedIndex];
    const next: RegistrationStep | undefined =
      REGISTRATION_STEPS[event.selectedIndex];
    if (previous && event.selectedIndex > event.previouslySelectedIndex) {
      this.analytics.trackStepCompleted(previous, { is_google: isGoogle });
    }
    if (next) {
      this.analytics.trackStepView(next, { is_google: isGoogle });
    }
    this.currentStepIndex = event.selectedIndex;
  }

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
      validate(password, ({ value }) =>
        !hasStrongPasswordPolicy(String(value() ?? ''))
          ? {
              kind: 'password-policy',
              message: $localize`:@@validate.password.policy:Passwort braucht Groß-/Kleinbuchstaben, Zahl und Sonderzeichen.`,
            }
          : undefined
      );
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
    const { password, repeatPassword } = this.registerForm().value();
    if (
      !this.registerUiStore.isCredentialStepValid(
        this.registerForm.email().invalid(),
        password,
        repeatPassword
      )
    )
      return;
    stepper.next();
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
    const isGoogle = this.registerUiStore.isGoogleRegistration();
    this.analytics.trackSubmitted({ is_google: isGoogle });
    if (!isGoogle) {
      const signedUp = await this.registerUiStore.signUpWithEmail(
        email,
        password
      );
      if (!signedUp) {
        this.analytics.trackFailed({ is_google: false, reason: 'sign_up' });
        return;
      }
    }
    try {
      const persisted = await this.registerUiStore.persistProfile();
      if (persisted) {
        this.analytics.trackSucceeded({ is_google: isGoogle });
      } else {
        this.analytics.trackFailed({
          is_google: isGoogle,
          reason: 'persist_profile',
        });
      }
    } catch {
      // RegisterOnboardingStore already exposes a localized error state.
      // Prevent unhandled promise rejections in the click handler.
      this.analytics.trackFailed({
        is_google: isGoogle,
        reason: 'persist_profile',
      });
    }
  }

  async goToDashboard(): Promise<void> {
    this.analytics.trackSuccessCta('dashboard');
    const planReturnUrl = this.registerUiStore.selectedPlanReturnUrl();
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    await this.router.navigateByUrl(planReturnUrl ?? returnUrl ?? '/app');
  }

  async goToTrainingPlans(): Promise<void> {
    this.analytics.trackSuccessCta('training_plans');
    await this.router.navigateByUrl('/training-plans');
  }

  async goToDailyGoalSettings(): Promise<void> {
    this.analytics.trackSuccessCta('daily_goal');
    await this.router.navigateByUrl('/goals');
  }
}
