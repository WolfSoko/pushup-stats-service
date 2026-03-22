import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { doc, Firestore, getDoc } from '@angular/fire/firestore';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { UserContextService } from './user-context.service';

export const adminGuard: CanActivateFn = async (): Promise<
  boolean | UrlTree
> => {
  // SSR: allow rendering — client-side re-check will redirect non-admins
  const platformId = inject(PLATFORM_ID);
  if (isPlatformServer(platformId)) {
    return true;
  }

  const firebaseAuth = inject(Auth, { optional: true });
  const firestore = inject(Firestore, { optional: true });
  const router = inject(Router);
  const userContext = inject(UserContextService);

  if (firebaseAuth) {
    await firebaseAuth.authStateReady();
  }

  const uid = userContext.userIdSafe();
  if (!uid || !firestore) {
    return router.createUrlTree(['/']);
  }

  // Load userConfig directly to get the authoritative role value
  const snap = await getDoc(doc(firestore, 'userConfigs', uid));
  const role = snap.exists() ? snap.data()?.['role'] : undefined;

  if (role === 'admin') {
    return true;
  }

  return router.createUrlTree(['/']);
};
