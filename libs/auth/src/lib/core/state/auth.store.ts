import { effect, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  type,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { event, on } from '@ngrx/signals/events';
import { AuthService } from '../auth.service';

export type AuthState = {
  loading: boolean;
  error: Error | null;
};

const initialState: AuthState = {
  loading: false,
  error: null,
};

export const registerWithEmailEvent = event(
  'registerWithEmail',
  type<{ email: string; passwort: string }>()
);
export const loginWithEmailEvent = event(
  'loginWithEmail',
  type<{ email: string; passwort: string }>()
);

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    _authService: inject(AuthService),
  })),
  withComputed((store) => ({
    user: store._authService.user,
    isAuthenticated: store._authService.isAuthenticated,
    idToken: store._authService.idToken,
  })),
  withMethods((store) => ({
    login: async () => {
      patchState(store, { loading: true, error: null });
      try {
        await store._authService.signInWithGoogle();
      } catch (e) {
        patchState(store, {
          error: e instanceof Error ? e : new Error(String(e)),
        });
      } finally {
        patchState(store, { loading: false });
      }
    },
    logout: async () => {
      patchState(store, { loading: true, error: null });
      try {
        await store._authService.logout();
      } catch (e) {
        patchState(store, {
          error: e instanceof Error ? e : new Error(String(e)),
        });
      } finally {
        patchState(store, { loading: false });
      }
    },
  })),
effect(() => {(on(registerWithEmailEvent.opened, () => ({ isLoading: true })),
  on(registerWithEmailEvent, async ({ email, passwort }) => {}));
})
);
