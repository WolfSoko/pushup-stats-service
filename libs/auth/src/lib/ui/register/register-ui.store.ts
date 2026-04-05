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
import { AuthStore } from '../../core/state/auth.store';
import { RegisterOnboardingStore } from '../../core/state/register-onboarding.store';
import { hasStrongPasswordPolicy } from '../password-policy';

type RegisterUiState = {
  hidePassword: boolean;
  displayName: string;
  dailyGoal: number;
  consentAccepted: boolean;
  isGoogleRegistration: boolean;
  registeringCredentials: boolean;
  registerSuccess: boolean;
};

const initialState: RegisterUiState = {
  hidePassword: true,
  displayName: '',
  dailyGoal: 10,
  consentAccepted: false,
  isGoogleRegistration: false,
  registeringCredentials: false,
  registerSuccess: false,
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
  })),
  withMethods(({ authStore, onboardingStore, auth, ...store }) => ({
    toggleHidePassword: () =>
      patchState(store, { hidePassword: !store.hidePassword() }),
    setDisplayName: (value: string) =>
      patchState(store, { displayName: value }),
    setDailyGoal: (value: number) => patchState(store, { dailyGoal: value }),
    setConsentAccepted: (value: boolean) =>
      patchState(store, { consentAccepted: value }),
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
    isProfileStepValid: () =>
      store.displayName().trim().length >= 2 && store.dailyGoal() >= 1,
    canSubmit: (
      emailInvalid: boolean,
      passwordInvalid: boolean,
      password: string,
      repeatPassword: string
    ) =>
      store.consentAccepted() &&
      store.displayName().trim().length >= 2 &&
      store.dailyGoal() >= 1 &&
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
        await authStore.signUpWithEmail(email, password);
        return !authStore.error();
      } finally {
        patchState(store, { registeringCredentials: false });
      }
    },
    signInWithGoogle: async (): Promise<boolean> => {
      patchState(store, { registeringCredentials: true });
      try {
        await authStore.upgradeWithGoogle();
        return !authStore.error();
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
