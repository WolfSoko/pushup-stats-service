import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { USER_PROFILE_PORT } from '../ports/user-profile.port';

type LoginOnboardingState = {
  loading: boolean;
  saving: boolean;
  error: string | null;
};

const initialState: LoginOnboardingState = {
  loading: false,
  saving: false,
  error: null,
};

export type GoogleOnboardingInput = {
  displayName: string;
  dailyGoal: number;
};

export const LoginOnboardingStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    userProfileApi: inject(USER_PROFILE_PORT),
  })),
  withMethods(({ userProfileApi, ...store }) => ({
    async isOnboardingRequired(uid: string): Promise<boolean> {
      patchState(store, { loading: true, error: null });
      try {
        const config = await firstValueFrom(userProfileApi.getConfig(uid));
        return (
          !config.displayName ||
          !config.dailyGoal ||
          !config.consent?.acceptedAt
        );
      } catch {
        return true;
      } finally {
        patchState(store, { loading: false });
      }
    },
    async saveGoogleOnboarding(
      uid: string,
      input: GoogleOnboardingInput
    ): Promise<void> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(
          userProfileApi.updateConfig(uid, {
            displayName: input.displayName.trim(),
            dailyGoal: Math.max(1, Number(input.dailyGoal || 100)),
            consent: {
              dataProcessing: true,
              statistics: true,
              targetedAds: true,
              acceptedAt: new Date().toISOString(),
            },
          })
        );
      } catch {
        patchState(store, {
          error: $localize`:@@auth.onboarding.google.error.saveFailed:Onboarding konnte nicht gespeichert werden. Bitte erneut versuchen.`,
        });
        throw new Error('save-onboarding-failed');
      } finally {
        patchState(store, { saving: false });
      }
    },
  }))
);
