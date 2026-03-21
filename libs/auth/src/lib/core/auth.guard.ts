import { inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { AuthStore } from './state/auth.store';

export const authGuard: CanActivateFn = async (
  _route,
  state
): Promise<boolean | UrlTree> => {
  const auth = inject(AuthStore);
  const firebaseAuth = inject(Auth, { optional: true });
  const router = inject(Router);

  // Wait for Firebase to restore the persisted session from IndexedDB before
  // deciding — prevents redirect to /login on page reload when a real session
  // exists but hasn't settled yet.
  if (firebaseAuth) {
    await firebaseAuth.authStateReady();
  }

  if (auth.isAuthenticated() || !!firebaseAuth?.currentUser) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url || '/app' },
  });
};

export const publicOnlyGuard: CanActivateFn = async (): Promise<
  boolean | UrlTree
> => {
  const auth = inject(AuthStore);
  const firebaseAuth = inject(Auth, { optional: true });
  const router = inject(Router);

  if (firebaseAuth) {
    await firebaseAuth.authStateReady();
  }

  if (!auth.isAuthenticated() || auth.isGuest()) return true;

  return router.createUrlTree(['/app']);
};
