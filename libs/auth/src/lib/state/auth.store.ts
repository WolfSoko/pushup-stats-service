import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { AuthService } from '../core/auth.service';
import { AuthState } from './auth.state';

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  idToken: null,
};

export const AuthStore = signalStore(
  withState(initialState),
  withProps(() => ({
    _authService: inject(AuthService),
  })),
  withComputed((store) => ({
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
  }))
);
