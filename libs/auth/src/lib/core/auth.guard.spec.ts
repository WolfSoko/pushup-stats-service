import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterModule,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { authGuard, publicOnlyGuard } from './auth.guard';
import { AuthStore } from './state/auth.store';

@Injectable()
class MockAuthStore {
  isAuthenticated = jest.fn();
  isGuest = jest.fn().mockReturnValue(false);
}

@Injectable()
class MockFirebaseAuth {
  currentUser: unknown = null;
  authStateReady = jest.fn().mockResolvedValue(undefined);
}

describe('auth.guard', () => {
  let authStore: MockAuthStore;
  let firebaseAuth: MockFirebaseAuth;
  let mockedRoute: ActivatedRouteSnapshot;
  let mockedRouterState: RouterStateSnapshot;

  beforeEach(() => {
    mockedRoute = {} as ActivatedRouteSnapshot;
    mockedRouterState = { url: '/settings' } as RouterStateSnapshot;

    TestBed.configureTestingModule({
      imports: [
        RouterModule.forRoot([{ path: 'login', component: {} as never }]),
      ],
      providers: [
        { provide: AuthStore, useClass: MockAuthStore },
        { provide: Auth, useClass: MockFirebaseAuth },
      ],
    });
    authStore = TestBed.inject(AuthStore) as unknown as MockAuthStore;
    firebaseAuth = TestBed.inject(Auth) as unknown as MockFirebaseAuth;
  });

  it('should return true when authenticated (given isAuthenticated true)', async () => {
    authStore.isAuthenticated.mockReturnValue(true);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockedRoute, mockedRouterState)
    );
    expect(result).toBe(true);
  });

  it('should return true when firebase currentUser exists (even if signal auth lags)', async () => {
    authStore.isAuthenticated.mockReturnValue(false);
    firebaseAuth.currentUser = { uid: 'u1' };

    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockedRoute, mockedRouterState)
    );
    expect(result).toBe(true);
  });

  it('should return UrlTree to /login with returnUrl when not authenticated', async () => {
    authStore.isAuthenticated.mockReturnValue(false);
    firebaseAuth.currentUser = null;
    const result = (await TestBed.runInInjectionContext(() =>
      authGuard(mockedRoute, mockedRouterState)
    )) as UrlTree;
    expect(result.toString()).toEqual('/login?returnUrl=%2Fsettings');
  });

  it('publicOnlyGuard should return true when not authenticated (given isAuthenticated false)', async () => {
    authStore.isAuthenticated.mockReturnValue(false);
    const result = await TestBed.runInInjectionContext(() =>
      publicOnlyGuard(mockedRoute, mockedRouterState)
    );
    expect(result).toBe(true);
  });

  it('publicOnlyGuard should return UrlTree to /app when authenticated (given isAuthenticated true)', async () => {
    authStore.isAuthenticated.mockReturnValue(true);
    authStore.isGuest.mockReturnValue(false);
    const result = (await TestBed.runInInjectionContext(() =>
      publicOnlyGuard(mockedRoute, mockedRouterState)
    )) as UrlTree;
    expect(result.toString()).toEqual('/app');
  });

  it('publicOnlyGuard should return true when authenticated but isGuest (anonymous user)', async () => {
    authStore.isAuthenticated.mockReturnValue(true);
    authStore.isGuest.mockReturnValue(true);
    const result = await TestBed.runInInjectionContext(() =>
      publicOnlyGuard(mockedRoute, mockedRouterState)
    );
    expect(result).toBe(true);
  });
});
