import { inject } from '@angular/core';
import {
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
  withComputed((_authService) => ({
    user: _authService.user,
    isAuthenticated: _authService.isAuthenticated,
    idToken: _authService.idToken,
  })),
  withMethods(({ _authService }) => ({
    login: async () => {
      patch({ loading: true, error: null });
      try {
        await _authService.signInWithGoogle();
      } catch (e) {
        patch({ error: e });
      } finally {
        patch({ loading: false });
      }
    },
    logout: async () => {
      patch({ loading: true, error: null });
      try {
        await _authService.logout();
      } catch (e) {
        patch({ error: e });
      } finally {
        patch({ loading: false });
      }
    },
  }))
);

/*
(withProps(() => ({
  _auth: inject(AuthService),
})),
  withComputed(({ _auth }) => ({
    user: _auth.user,
    isAuthenticated: _auth.isAuthenticated,
  })));
*/
