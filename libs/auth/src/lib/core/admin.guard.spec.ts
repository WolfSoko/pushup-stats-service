import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { adminGuard } from './admin.guard';

describe('adminGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/admin' } as RouterStateSnapshot;

  function setup(opts: {
    platform?: string;
    currentUser?: {
      getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>;
    } | null;
    authStateReady?: () => Promise<void>;
  }) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: opts.platform ?? 'browser' },
        {
          provide: Auth,
          useValue: {
            currentUser: opts.currentUser ?? null,
            authStateReady: opts.authStateReady ?? (() => Promise.resolve()),
          },
        },
      ],
    });
  }

  it('should allow access on SSR (server platform)', async () => {
    setup({ platform: 'server' });

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard(route, state)
    );
    expect(result).toBe(true);
  });

  it('should redirect unauthenticated user to /', async () => {
    setup({ currentUser: null });

    const result = (await TestBed.runInInjectionContext(() =>
      adminGuard(route, state)
    )) as UrlTree;
    expect(result.toString()).toBe('/');
  });

  it('should allow access when user has admin custom claim', async () => {
    setup({
      currentUser: {
        getIdTokenResult: () => Promise.resolve({ claims: { admin: true } }),
      },
    });

    const result = await TestBed.runInInjectionContext(() =>
      adminGuard(route, state)
    );
    expect(result).toBe(true);
  });

  it('should redirect when user lacks admin claim', async () => {
    setup({
      currentUser: {
        getIdTokenResult: () => Promise.resolve({ claims: {} }),
      },
    });

    const result = (await TestBed.runInInjectionContext(() =>
      adminGuard(route, state)
    )) as UrlTree;
    expect(result.toString()).toBe('/');
  });

  it('should redirect when admin claim is not boolean true', async () => {
    setup({
      currentUser: {
        getIdTokenResult: () => Promise.resolve({ claims: { admin: 'true' } }),
      },
    });

    const result = (await TestBed.runInInjectionContext(() =>
      adminGuard(route, state)
    )) as UrlTree;
    expect(result.toString()).toBe('/');
  });

  it('should redirect safely when getIdTokenResult rejects', async () => {
    setup({
      currentUser: {
        getIdTokenResult: () =>
          Promise.reject(new Error('token refresh failed')),
      },
    });

    const result = (await TestBed.runInInjectionContext(() =>
      adminGuard(route, state)
    )) as UrlTree;
    expect(result.toString()).toBe('/');
  });

  it('should redirect when Firebase Auth is not available', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Auth, useValue: null },
      ],
    });

    const result = (await TestBed.runInInjectionContext(() =>
      adminGuard(route, state)
    )) as UrlTree;
    expect(result.toString()).toBe('/');
  });
});
