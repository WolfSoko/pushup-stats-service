import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { AuthService } from '../auth.service';

export type AuthState = {
  loading: boolean;
  error: Error | null;
};

const initialState: AuthState = {
  loading: false,
  error: null,
};

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
    deleteAccount: async () => {
      patchState(store, { loading: true, error: null });
      try {
        await _authService.deleteAccount();
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
