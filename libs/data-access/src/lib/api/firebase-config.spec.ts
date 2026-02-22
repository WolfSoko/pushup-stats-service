import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { isFirebaseConfigured, resolveFirebaseConfig } from './firebase-config';

describe('firebase-config (libs)', () => {
  it('returns empty config on server', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    const cfg = TestBed.runInInjectionContext(() => resolveFirebaseConfig());
    expect(cfg).toEqual({
      apiKey: '',
      authDomain: '',
      projectId: '',
      appId: '',
    });
    expect(isFirebaseConfigured(cfg)).toBe(false);
  });

  it('reads config from window on browser', () => {
    (globalThis as unknown as { __PUS_FIREBASE__?: unknown }).__PUS_FIREBASE__ =
      {
        apiKey: 'key',
        authDomain: 'domain',
        projectId: 'project',
        appId: 'app',
      };

    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const cfg = TestBed.runInInjectionContext(() => resolveFirebaseConfig());
    expect(isFirebaseConfigured(cfg)).toBe(true);
  });

  it('returns empty config when window config missing', () => {
    (globalThis as unknown as { __PUS_FIREBASE__?: unknown }).__PUS_FIREBASE__ =
      undefined;

    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const cfg = TestBed.runInInjectionContext(() => resolveFirebaseConfig());
    expect(isFirebaseConfigured(cfg)).toBe(false);
    expect(cfg.projectId).toBe('');
  });

  it('returns false when config incomplete', () => {
    (globalThis as unknown as { __PUS_FIREBASE__?: unknown }).__PUS_FIREBASE__ =
      {
        apiKey: 'key',
      };

    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const cfg = TestBed.runInInjectionContext(() => resolveFirebaseConfig());
    expect(isFirebaseConfigured(cfg)).toBe(false);
  });
});
