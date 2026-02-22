import { inject, Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  Router,
} from '@angular/router';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AuthService } from '@pu-auth/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private readonly firebaseAuth = inject(AuthService);
  private readonly router = inject(Router);

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ):
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree>
    | boolean
    | UrlTree {
    // Check if user is logged in via Firebase
    const isLoggedIn = this.firebaseAuth.isAuthenticated();

    if (isLoggedIn) {
      return true; // User is logged in, allow access
    } else {
      console.warn('AuthGuard: User not logged in, redirecting.');
      // Redirect to login can be initiated
      return this.router.createUrlTree(['/login']);
    }
  }
}
