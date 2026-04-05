import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { AuthStore } from '../../core/state/auth.store';
import { LoginOnboardingStore } from '../../core/state/login-onboarding.store';

type LoginUiState = {
  hidePassword: boolean;
  googleDisplayName: string;
  googleDailyGoal: number;
  googleConsentAccepted: boolean;
  googleWizardStep: number;
  googleWizardError: string | null;
};

const initialState: LoginUiState = {
  hidePassword: true,
  googleDisplayName: '',
  googleDailyGoal: 100,
  googleConsentAccepted: false,
  googleWizardStep: 0,
  googleWizardError: null,
};

export const LoginUiStore = signalStore(
  withState(initialState),
  withProps(() => ({
    authStore: inject(AuthStore),
    onboardingStore: inject(LoginOnboardingStore),
  })),
  withComputed(({ authStore }) => ({
    loading: computed(() => authStore.loading()),
    error: computed(() => authStore.error()),
  })),
  withMethods(({ authStore, onboardingStore, ...store }) => ({
    currentUserDisplayName: (): string => authStore.user()?.displayName ?? '',
    toggleHidePassword: () =>
      patchState(store, { hidePassword: !store.hidePassword() }),
    setGoogleDisplayName: (value: string) =>
      patchState(store, { googleDisplayName: value }),
    setGoogleDailyGoal: (value: number) =>
      patchState(store, { googleDailyGoal: value }),
    setGoogleConsentAccepted: (value: boolean) =>
      patchState(store, { googleConsentAccepted: value }),
    nextWizardStep: () =>
      patchState(store, {
        googleWizardStep: Math.min(2, store.googleWizardStep() + 1),
      }),
    previousWizardStep: () =>
      patchState(store, {
        googleWizardStep: Math.max(0, store.googleWizardStep() - 1),
      }),
    resetWizard: (displayName = '') => {
      patchState(store, {
        googleDisplayName: displayName,
        googleDailyGoal: 100,
        googleConsentAccepted: false,
        googleWizardStep: 0,
        googleWizardError: null,
      });
    },
    signInWithEmail: async (
      email: string,
      password: string
    ): Promise<boolean> => {
      await authStore.signInWithEmail(email, password);
      return !authStore.error();
    },
    signInWithGoogle: async (): Promise<boolean> => {
      await authStore.login();
      return !authStore.error();
    },
    logout: async (): Promise<void> => {
      await authStore.logout();
    },
    isGoogleOnboardingRequired: async (): Promise<boolean> => {
      const uid = authStore.user()?.uid;
      if (!uid) return false;
      return onboardingStore.isOnboardingRequired(uid);
    },
    completeGoogleOnboarding: async (): Promise<boolean> => {
      const uid = authStore.user()?.uid;
      if (!uid) {
        patchState(store, {
          googleWizardError: $localize`:@@auth.onboarding.google.error.noUser:Kein eingeloggter Nutzer gefunden.`,
        });
        return false;
      }
      if (!store.googleConsentAccepted()) {
        patchState(store, {
          googleWizardError: $localize`:@@auth.onboarding.google.error.consentRequired:Bitte stimme der Datenverarbeitung zu.`,
        });
        return false;
      }
      try {
        await onboardingStore.saveGoogleOnboarding(uid, {
          displayName: store.googleDisplayName(),
          dailyGoal: store.googleDailyGoal(),
        });
        return true;
      } catch {
        patchState(store, { googleWizardError: onboardingStore.error() });
        return false;
      }
    },
  }))
);
