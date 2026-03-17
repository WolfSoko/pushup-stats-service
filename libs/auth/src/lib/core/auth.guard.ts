import { inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { AuthStore } from './state/auth.store';

export const authGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const auth = inject(AuthStore);
  const firebaseAuth = inject(Auth, { optional: true });
  const router = inject(Router);

  // Firebase currentUser may already be set while signal-based auth state is
  // still catching up right after login. Accept either source.
  if (auth.isAuthenticated() || !!firebaseAuth?.currentUser) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url || '/app' },
  });
};

export const publicOnlyGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  if (!auth.isAuthenticated() || auth.isGuest()) return true;

  return router.createUrlTree(['/app']);
};
