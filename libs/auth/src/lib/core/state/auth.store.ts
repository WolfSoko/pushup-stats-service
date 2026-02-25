import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  type,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { event } from '@ngrx/signals/events';
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
  withMethods(({ _authService, ...store }) => ({
    login: async () => {
      patchState(store, { loading: true, error: null });
      try {
        await _authService.signInWithGoogle();
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
        await _authService.logout();
      } catch (e) {
        patchState(store, {
          error: e instanceof Error ? e : new Error(String(e)),
        });
      } finally {
        patchState(store, { loading: false });
      }
    },
    signInWithEmail: async (email: string, password: string) => {
      patchState(store, { loading: true, error: null });
      try {
        await _authService.signInWithEmail(email, password);
      } catch (e) {
        patchState(store, {
          error: e instanceof Error ? e : new Error(String(e)),
        });
      } finally {
        patchState(store, { loading: false });
      }
    },
    signUpWithEmail: async (email: string, password: string) => {
      patchState(store, { loading: true, error: null });
      try {
        await _authService.signUpWithEmail(email, password);
      } catch (e) {
        patchState(store, {
          error: e instanceof Error ? e : new Error(String(e)),
        });
      } finally {
        patchState(store, { loading: false });
      }
    },
  }))
);
