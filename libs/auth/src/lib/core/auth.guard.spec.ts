import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterModule,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { authGuard, publicOnlyGuard } from './auth.guard';
import { AuthStore } from './state/auth.store';

@Injectable()
class MockAuthStore {
  isAuthenticated = jest.fn();
}
describe('auth.guard', () => {
  let authStore: MockAuthStore;
  let mockedRoute: ActivatedRouteSnapshot;
  let mockedRouterState: RouterStateSnapshot;

  beforeEach(() => {
    mockedRoute = {} as ActivatedRouteSnapshot;
    mockedRouterState = {} as RouterStateSnapshot;

    TestBed.configureTestingModule({
      imports: [
        RouterModule.forRoot([{ path: 'login', component: {} as never }]),
      ],
      providers: [{ provide: AuthStore, useClass: MockAuthStore }],
    });
    authStore = TestBed.inject(AuthStore) as unknown as MockAuthStore;
  });

  it('should return true when authenticated (given isAuthenticated true)', () => {
    authStore.isAuthenticated.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      authGuard(mockedRoute, mockedRouterState)
    );
    expect(result).toBe(true);
  });

  it('should return UrlTree to /login when not authenticated (given isAuthenticated false)', () => {
    authStore.isAuthenticated.mockReturnValue(false);
    const result = TestBed.runInInjectionContext(() =>
      authGuard(mockedRoute, mockedRouterState)
    ) as UrlTree;
    expect(result.toString()).toEqual('/login');
  });

  it('publicOnlyGuard should return true when not authenticated (given isAuthenticated false)', () => {
    authStore.isAuthenticated.mockReturnValue(false);
    const result = TestBed.runInInjectionContext(() =>
      publicOnlyGuard(mockedRoute, mockedRouterState)
    );
    expect(result).toBe(true);
  });

  it('publicOnlyGuard should return UrlTree to /app when authenticated (given isAuthenticated true)', () => {
    authStore.isAuthenticated.mockReturnValue(true);
    const result = TestBed.runInInjectionContext(() =>
      publicOnlyGuard(mockedRoute, mockedRouterState)
    ) as UrlTree;
    expect(result.toString()).toEqual('/app');
  });
});
