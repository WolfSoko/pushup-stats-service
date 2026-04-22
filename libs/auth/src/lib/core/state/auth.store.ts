import { computed, inject } from '@angular/core';
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

function toFriendlyAuthError(error: unknown): Error {
  const fallback =
    error instanceof Error
      ? error
      : new Error(
          $localize`:@@auth.error.generic:Anmeldung fehlgeschlagen. Bitte versuche es erneut.`
        );

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '').replace('auth/', '')
      : '';

  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = code || (message.match(/auth\/([a-z-]+)/)?.[1] ?? '');

  const map: Record<string, string> = {
    'popup-closed-by-user': $localize`:@@auth.error.popupClosed:Google-Anmeldung abgebrochen. Das Anmelde-Fenster wurde geschlossen.`,
    'popup-blocked': $localize`:@@auth.error.popupBlocked:Pop-up wurde blockiert. Bitte Pop-ups erlauben und erneut versuchen.`,
    'network-request-failed': $localize`:@@auth.error.network:Netzwerkfehler. Bitte Internetverbindung prüfen und erneut versuchen.`,
    'invalid-credential': $localize`:@@auth.error.invalidCredential:E-Mail oder Passwort ist nicht korrekt.`,
    'invalid-email': $localize`:@@auth.error.invalidEmail:Bitte eine gültige E-Mail-Adresse eingeben.`,
    'user-disabled': $localize`:@@auth.error.userDisabled:Dieses Konto ist deaktiviert.`,
    'user-not-found': $localize`:@@auth.error.userNotFound:Kein Konto mit dieser E-Mail gefunden.`,
    'wrong-password': $localize`:@@auth.error.wrongPassword:E-Mail oder Passwort ist nicht korrekt.`,
    'email-already-in-use': $localize`:@@auth.error.emailInUse:Für diese E-Mail existiert bereits ein Konto.`,
    'weak-password': $localize`:@@auth.error.weakPassword:Das Passwort ist zu schwach (mindestens 6 Zeichen).`,
    'too-many-requests': $localize`:@@auth.error.tooManyRequests:Zu viele Versuche. Bitte kurz warten und erneut versuchen.`,
    'internal-error': $localize`:@@auth.error.internalError:Ein technischer Fehler ist aufgetreten. Bitte gleich erneut versuchen.`,
  };

  if (normalized && map[normalized]) {
    return new Error(map[normalized]);
  }

  return fallback;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    _authService: inject(AuthService),
  })),
  withComputed((store) => ({
    user: store._authService.user,
    isAuthenticated: store._authService.isAuthenticated,
    authResolved: store._authService.authResolved,
    idToken: store._authService.idToken,
    isGuest: computed(() => store._authService.user()?.isAnonymous ?? false),
  })),
  withMethods(({ _authService, ...store }) => ({
    login: async (): Promise<boolean> => {
      patchState(store, { loading: true, error: null });
      try {
        await _authService.signInWithGoogleAndMigrateGuest();
        return true;
      } catch (e) {
        patchState(store, {
          error: toFriendlyAuthError(e),
        });
        return false;
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
          error: toFriendlyAuthError(e),
        });
      } finally {
        patchState(store, { loading: false });
      }
    },
    unsubscribeAllPushDevices: async (): Promise<boolean> => {
      patchState(store, { loading: true, error: null });
      try {
        await _authService.unsubscribeAllPushDevices();
        return true;
      } catch (e) {
        patchState(store, {
          error: toFriendlyAuthError(e),
        });
        return false;
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
          error: toFriendlyAuthError(e),
        });
      } finally {
        patchState(store, { loading: false });
      }
    },
    signInWithEmail: async (
      email: string,
      password: string
    ): Promise<boolean> => {
      patchState(store, { loading: true, error: null });
      try {
        await _authService.signInWithEmailAndMigrateGuest(email, password);
        return true;
      } catch (e) {
        patchState(store, {
          error: toFriendlyAuthError(e),
        });
        return false;
      } finally {
        patchState(store, { loading: false });
      }
    },
    signUpWithEmail: async (
      email: string,
      password: string
    ): Promise<boolean> => {
      patchState(store, { loading: true, error: null });
      try {
        await _authService.upgradeWithEmail(email, password);
        return true;
      } catch (e) {
        patchState(store, {
          error: toFriendlyAuthError(e),
        });
        return false;
      } finally {
        patchState(store, { loading: false });
      }
    },
    upgradeWithGoogle: async (): Promise<boolean> => {
      patchState(store, { loading: true, error: null });
      try {
        await _authService.upgradeWithGoogle();
        return true;
      } catch (e) {
        patchState(store, {
          error: toFriendlyAuthError(e),
        });
        return false;
      } finally {
        patchState(store, { loading: false });
      }
    },
    tryAsGuest: async (): Promise<boolean> => {
      patchState(store, { loading: true, error: null });
      try {
        await _authService.signInGuestIfNeeded();
        return true;
      } catch (e) {
        patchState(store, {
          error: toFriendlyAuthError(e),
        });
        return false;
      } finally {
        patchState(store, { loading: false });
      }
    },
  }))
);
