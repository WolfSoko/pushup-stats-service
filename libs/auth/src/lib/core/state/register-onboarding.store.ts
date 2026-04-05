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

export type RegisterProfileInput = {
  uid: string;
  displayName: string;
  dailyGoal: number;
  weeklyGoal: number;
  monthlyGoal: number;
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
    userProfileApi: inject(USER_PROFILE_PORT),
  })),
  withMethods(({ userProfileApi, ...store }) => ({
    async saveProfile(input: RegisterProfileInput): Promise<void> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(
          userProfileApi.updateConfig(input.uid, {
            displayName: input.displayName.trim(),
            dailyGoal: Math.max(1, Number(input.dailyGoal || 100)),
            weeklyGoal: Math.max(
              1,
              Number(
                input.weeklyGoal ||
                  Math.max(1, Number(input.dailyGoal || 100)) * 5
              )
            ),
            monthlyGoal: Math.max(
              1,
              Number(
                input.monthlyGoal ||
                  Math.max(1, Number(input.dailyGoal || 100)) * 20
              )
            ),
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
