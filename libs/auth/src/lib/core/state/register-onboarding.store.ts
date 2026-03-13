import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { UserConfigApiService } from '@pu-stats/data-access';
import { firstValueFrom } from 'rxjs';

export type RegisterProfileInput = {
  uid: string;
  displayName: string;
  dailyGoal: number;
};

type RegisterOnboardingState = {
  saving: boolean;
  error: string | null;
};

const initialState: RegisterOnboardingState = {
  saving: false,
  error: null,
};

export const RegisterOnboardingStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    userConfigApi: inject(UserConfigApiService),
  })),
  withMethods(({ userConfigApi, ...store }) => ({
    async saveProfile(input: RegisterProfileInput): Promise<void> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(
          userConfigApi.updateConfig(input.uid, {
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
          error: $localize`:@@auth.register.error.profileSaveFailed:Profil konnte nicht gespeichert werden. Bitte erneut versuchen.`,
        });
        throw new Error('save-register-profile-failed');
      } finally {
        patchState(store, { saving: false });
      }
    },
  }))
);
