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
import { hasStrongPasswordPolicy } from '../login/login.component';

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
  dailyGoal: 100,
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
      patchState(store, {
        isGoogleRegistration: true,
        displayName: authStore.user()?.displayName ?? '',
      });
      return authStore.user()?.email ?? '';
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
        return authStore.isAuthenticated();
      } finally {
        patchState(store, { registeringCredentials: false });
      }
    },
    signInWithGoogle: async (): Promise<boolean> => {
      patchState(store, { registeringCredentials: true });
      try {
        await authStore.upgradeWithGoogle();
        return authStore.isAuthenticated();
      } finally {
        patchState(store, { registeringCredentials: false });
      }
    },
    persistProfile: async (): Promise<boolean> => {
      const uid = auth?.currentUser?.uid ?? authStore.user()?.uid;
      if (!uid) return false;
      try {
        await onboardingStore.saveProfile({
          uid,
          displayName: store.displayName(),
          dailyGoal: store.dailyGoal(),
        });
        patchState(store, { registerSuccess: true });
        return true;
      } catch {
        return false;
      }
    },
  }))
);
