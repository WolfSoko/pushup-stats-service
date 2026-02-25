import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard, publicOnlyGuard } from './auth.guard';
import { AuthStore } from './state/auth.store';

@Injectable()
class MockAuthStore {
  isAuthenticated = jest.fn();
}
@Injectable()
class MockRouter {
  createUrlTree = jest.fn((url: string[]) => ({ url }));
}

describe('auth.guard', () => {
  let authStore: MockAuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useClass: MockAuthStore },
        { provide: Router, useClass: MockRouter },
      ],
    });
    authStore = TestBed.inject(AuthStore) as unknown as MockAuthStore;
  });

  it('should return true when authenticated (given isAuthenticated true)', () => {
    authStore.isAuthenticated.mockReturnValue(true);
    const result = TestBed.runInInjectionContext(() => authGuard());
    expect(result).toBe(true);
  });

  it('should return UrlTree to /login when not authenticated (given isAuthenticated false)', () => {
    authStore.isAuthenticated.mockReturnValue(false);
    const result = TestBed.runInInjectionContext(() => authGuard()) as UrlTree;
    expect((result as { url: string[] }).url).toEqual(['/login']);
  });

  it('publicOnlyGuard should return true when not authenticated (given isAuthenticated false)', () => {
    authStore.isAuthenticated.mockReturnValue(false);
    const result = TestBed.runInInjectionContext(() => publicOnlyGuard());
    expect(result).toBe(true);
  });

  it('publicOnlyGuard should return UrlTree to / when authenticated (given isAuthenticated true)', () => {
    authStore.isAuthenticated.mockReturnValue(true);
    const result = TestBed.runInInjectionContext(() =>
      publicOnlyGuard()
    ) as UrlTree;
    expect(result.url).toEqual(['/']);
  });
});
