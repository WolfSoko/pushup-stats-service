import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { AuthStore } from './state/auth.store';

export const authGuard: CanActivateFn = async (
  _route,
  state
): Promise<boolean | UrlTree> => {
  // SSR: allow all — the page will render with demo data for search engines
  const platformId = inject(PLATFORM_ID);
  if (isPlatformServer(platformId)) {
    return true;
  }

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

  // Use synchronous currentUser as authoritative fallback to avoid toSignal()
  // lag — the same pattern used in authGuard. Without this, an authenticated
  // user can slip through to /login or /register during the brief window
  // between authStateReady() resolving and the signal settling, causing
  // unexpected navigation loops or mid-flow redirects.
  const currentUser = firebaseAuth?.currentUser ?? null;
  const isAuthenticated = auth.isAuthenticated() || !!currentUser;
  const isGuest = currentUser ? currentUser.isAnonymous : auth.isGuest();

  if (!isAuthenticated || isGuest) return true;

  return router.createUrlTree(['/app']);
};
