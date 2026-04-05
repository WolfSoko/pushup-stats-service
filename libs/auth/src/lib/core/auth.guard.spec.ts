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
import { makeAuthStoreMock, makeFirebaseAuthMock } from '@pu-stats/testing';

describe('auth.guard', () => {
  const mockedRoute = {} as ActivatedRouteSnapshot;
  const mockedRouterState = { url: '/settings' } as RouterStateSnapshot;

  function setup(opts: {
    isAuthenticated: boolean;
    isGuest?: boolean;
    currentUser?: object | null;
  }) {
    TestBed.configureTestingModule({
      imports: [
        RouterModule.forRoot([{ path: 'login', component: {} as never }]),
      ],
      providers: [
        {
          provide: AuthStore,
          useValue: makeAuthStoreMock({
            isAuthenticated: opts.isAuthenticated,
            isGuest: opts.isGuest ?? false,
          }),
        },
        {
          provide: Auth,
          useValue: makeFirebaseAuthMock({
            currentUser:
              opts.currentUser !== undefined
                ? (opts.currentUser as never)
                : null,
          }),
        },
      ],
    });
  }

  it('should return true when authenticated (given isAuthenticated true)', async () => {
    setup({ isAuthenticated: true });

    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockedRoute, mockedRouterState)
    );
    expect(result).toBe(true);
  });

  it('should return true when firebase currentUser exists (even if signal auth lags)', async () => {
    setup({ isAuthenticated: false, currentUser: { uid: 'u1' } });

    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockedRoute, mockedRouterState)
    );
    expect(result).toBe(true);
  });

  it('should return UrlTree to /login with returnUrl when not authenticated', async () => {
    setup({ isAuthenticated: false, currentUser: null });

    const result = (await TestBed.runInInjectionContext(() =>
      authGuard(mockedRoute, mockedRouterState)
    )) as UrlTree;
    expect(result.toString()).toEqual('/login?returnUrl=%2Fsettings');
  });

  it('publicOnlyGuard should return true when not authenticated (given isAuthenticated false)', async () => {
    setup({ isAuthenticated: false });

    const result = await TestBed.runInInjectionContext(() =>
      publicOnlyGuard(mockedRoute, mockedRouterState)
    );
    expect(result).toBe(true);
  });

  it('publicOnlyGuard should return UrlTree to /app when authenticated (given isAuthenticated true)', async () => {
    setup({ isAuthenticated: true, isGuest: false });

    const result = (await TestBed.runInInjectionContext(() =>
      publicOnlyGuard(mockedRoute, mockedRouterState)
    )) as UrlTree;
    expect(result.toString()).toEqual('/app');
  });

  it('publicOnlyGuard should return true when authenticated but isGuest (anonymous user)', async () => {
    setup({ isAuthenticated: true, isGuest: true });

    const result = await TestBed.runInInjectionContext(() =>
      publicOnlyGuard(mockedRoute, mockedRouterState)
    );
    expect(result).toBe(true);
  });

  // Regression tests for Bug 1: publicOnlyGuard must use synchronous currentUser
  // as fallback (same as authGuard) to avoid toSignal() lag.

  it('publicOnlyGuard should redirect authenticated non-guest user even when signal lags (currentUser fallback)', async () => {
    // Signal says "not authenticated" (toSignal lag), but Firebase already has a real user
    setup({
      isAuthenticated: false,
      isGuest: false,
      currentUser: { uid: 'u1', isAnonymous: false },
    });

    const result = (await TestBed.runInInjectionContext(() =>
      publicOnlyGuard(mockedRoute, mockedRouterState)
    )) as UrlTree;

    expect(result.toString()).toEqual('/app');
  });

  it('publicOnlyGuard should allow access when currentUser is an anonymous user (guest)', async () => {
    // Signal says "not authenticated", and currentUser is anonymous → guest, allow access
    setup({
      isAuthenticated: false,
      isGuest: true,
      currentUser: { uid: 'anon-1', isAnonymous: true },
    });

    const result = await TestBed.runInInjectionContext(() =>
      publicOnlyGuard(mockedRoute, mockedRouterState)
    );

    expect(result).toBe(true);
  });
});
