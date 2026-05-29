import { computed, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import {
  DisplayNameViolation,
  findPlanById,
  TrainingPlan,
  validateDisplayName,
} from '@pu-stats/models';
import { AuthStore } from '../../core/state/auth.store';
import { RegisterOnboardingStore } from '../../core/state/register-onboarding.store';
import { hasStrongPasswordPolicy } from '../password-policy';

type RegisterUiState = {
  hidePassword: boolean;
  displayName: string;
  /**
   * Onboarding no longer asks for a daily goal — registration completes after
   * the username step. This default is persisted so the new account has
   * sensible goals; the success screen links to `/goals` to fine-tune it.
   */
  dailyGoal: number;
  isGoogleRegistration: boolean;
  registeringCredentials: boolean;
  registerSuccess: boolean;
  /**
   * Plan id pre-selected via `?planId=...` on the register URL — set when the
   * user lands here from a training plan detail page. Drives the post-signup
   * redirect to `/training-plans/:slug?autoStart=1` so the plan is started
   * automatically once the account is ready.
   */
  selectedPlanId: string | null;
};

const initialState: RegisterUiState = {
  hidePassword: true,
  displayName: '',
  dailyGoal: 10,
  isGoogleRegistration: false,
  registeringCredentials: false,
  registerSuccess: false,
  selectedPlanId: null,
};

export const RegisterUiStore = signalStore(
  withState(initialState),
  withProps(() => ({
    authStore: inject(AuthStore),
    onboardingStore: inject(RegisterOnboardingStore),
    auth: inject(Auth, { optional: true }),
  })),
  withComputed(({ authStore, onboardingStore, ...store }) => ({
    loading: computed(
      () =>
        authStore.loading() ||
        onboardingStore.saving() ||
        store.registeringCredentials()
    ),
    onboardingError: computed(() => onboardingStore.error()),
    selectedPlan: computed<TrainingPlan | null>(() => {
      const id = store.selectedPlanId();
      return id ? findPlanById(id) : null;
    }),
    displayNameViolation: computed<DisplayNameViolation | null>(() =>
      validateDisplayName(store.displayName())
    ),
  })),
  withMethods(({ authStore, onboardingStore, auth, ...store }) => ({
    toggleHidePassword: () =>
      patchState(store, { hidePassword: !store.hidePassword() }),
    setDisplayName: (value: string) =>
      patchState(store, { displayName: value }),
    setSelectedPlanId: (planId: string | null) => {
      // Only accept ids that resolve to a real plan; ignore stale or
      // malformed query-param values silently — better than redirecting
      // the user into a dead-end after registration.
      const resolved = planId && findPlanById(planId) ? planId : null;
      patchState(store, { selectedPlanId: resolved });
    },
    selectedPlanReturnUrl: (): string | null => {
      const id = store.selectedPlanId();
      if (!id) return null;
      const plan = findPlanById(id);
      return plan ? `/training-plans/${plan.slug}?autoStart=1` : null;
    },
    prepareGoogleRegistration: () => {
      // Prefer auth.currentUser (synchronous, immediately available after the
      // Google popup closes) over the signal-based authStore.user() which is
      // backed by toSignal() and may still hold stale anonymous-user data.
      const currentUser = auth?.currentUser ?? authStore.user();
      patchState(store, {
        isGoogleRegistration: true,
        displayName: currentUser?.displayName ?? '',
      });
      return currentUser?.email ?? '';
    },
    resetSuccess: () => patchState(store, { registerSuccess: false }),
    isCredentialStepValid: (
      emailInvalid: boolean,
      password: string,
      repeatPassword: string
    ) =>
      !emailInvalid &&
      hasStrongPasswordPolicy(password) &&
      password === repeatPassword,
    isProfileStepValid: () => validateDisplayName(store.displayName()) === null,
    canSubmit: (
      emailInvalid: boolean,
      passwordInvalid: boolean,
      password: string,
      repeatPassword: string
    ) =>
      validateDisplayName(store.displayName()) === null &&
      (store.isGoogleRegistration() ||
        (!emailInvalid &&
          !passwordInvalid &&
          hasStrongPasswordPolicy(password) &&
          password === repeatPassword)),
    signUpWithEmail: async (
      email: string,
      password: string
    ): Promise<boolean> => {
      patchState(store, { registeringCredentials: true });
      try {
        return await authStore.signUpWithEmail(email, password);
      } finally {
        patchState(store, { registeringCredentials: false });
      }
    },
    signInWithGoogle: async (): Promise<boolean> => {
      patchState(store, { registeringCredentials: true });
      try {
        return await authStore.upgradeWithGoogle();
      } finally {
        patchState(store, { registeringCredentials: false });
      }
    },
    persistProfile: async (): Promise<boolean> => {
      const uid = auth?.currentUser?.uid ?? authStore.user()?.uid;
      if (!uid) return false;
      try {
        const daily = Math.max(1, Math.trunc(store.dailyGoal()));
        await onboardingStore.saveProfile({
          uid,
          displayName: store.displayName(),
          dailyGoal: daily,
          weeklyGoal: daily * 5,
          monthlyGoal: daily * 20,
        });
        patchState(store, { registerSuccess: true });
        return true;
      } catch {
        return false;
      }
    },
  }))
);
