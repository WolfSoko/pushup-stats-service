import { inject, Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  Router,
} from '@angular/router';
import { Observable } from 'rxjs';
import { FirebaseAuthService } from './firebase/firebase-auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private readonly firebaseAuth = inject(FirebaseAuthService);
  private readonly router = inject(Router);

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ):
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree>
    | boolean
    | UrlTree {
    // If Firebase auth is not enabled globally, allow access by default
    if (!this.firebaseAuth.enabled) {
      return true;
    }

    // Check if user is logged in via Firebase
    const isLoggedIn = !!this.firebaseAuth.user();

    if (isLoggedIn) {
      return true; // User is logged in, allow access
    } else {
      console.warn('AuthGuard: User not logged in, redirecting.');
      // Redirect to settings where login can be initiated
      return this.router.createUrlTree(['/settings']);
    }
  }
}
