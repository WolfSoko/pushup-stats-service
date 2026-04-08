import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';

export const adminGuard: CanActivateFn = async (): Promise<
  boolean | UrlTree
> => {
  // SSR: allow rendering — client-side re-check will redirect non-admins
  const platformId = inject(PLATFORM_ID);
  if (isPlatformServer(platformId)) {
    return true;
  }

  const firebaseAuth = inject(Auth, { optional: true });
  const router = inject(Router);

  if (!firebaseAuth) {
    return router.createUrlTree(['/']);
  }

  await firebaseAuth.authStateReady();

  const user = firebaseAuth.currentUser;
  if (!user) {
    return router.createUrlTree(['/']);
  }

  const tokenResult = await user.getIdTokenResult();
  if (tokenResult.claims['admin'] === true) {
    return true;
  }

  return router.createUrlTree(['/']);
};
