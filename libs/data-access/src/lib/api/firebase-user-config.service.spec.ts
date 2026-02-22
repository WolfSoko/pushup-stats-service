import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { FirebaseUserConfigService } from './firebase-user-config.service';

const getDocMock = jest.fn(async () => ({ data: () => ({ dailyGoal: 123 }) }));
const setDocMock = jest.fn(async () => undefined);
const docMock = jest.fn(() => 'doc-ref');
const getFirestoreMock = jest.fn(() => ({ name: 'firestore' }));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'app' })),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => getFirestoreMock()),
  doc: (...args: unknown[]) => docMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
}));

describe('FirebaseUserConfigService', () => {
  beforeEach(() => {
    (globalThis as unknown as { __PUS_FIREBASE__?: unknown }).__PUS_FIREBASE__ =
      {
        apiKey: 'key',
        authDomain: 'domain',
        projectId: 'project',
        appId: 'app',
      };
  });

  it('returns empty config when disabled', (done) => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    const service = TestBed.inject(FirebaseUserConfigService);
    service.getConfig('u1').subscribe((cfg) => {
      expect(cfg).toEqual({});
      done();
    });
  });

  it('is disabled when config missing in browser', () => {
    (globalThis as unknown as { __PUS_FIREBASE__?: unknown }).__PUS_FIREBASE__ =
      undefined;

    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const service = TestBed.inject(FirebaseUserConfigService);
    expect(service.enabled).toBe(false);
  });

  it('returns empty config from updateConfig when disabled', (done) => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    const service = TestBed.inject(FirebaseUserConfigService);
    service.updateConfig('u1', { colorTheme: 'dark' }).subscribe((cfg) => {
      expect(cfg).toEqual({});
      done();
    });
  });

  it('reads and writes config when enabled', (done) => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const service = TestBed.inject(FirebaseUserConfigService);
    expect(service.enabled).toBe(true);

    service.getConfig('u1').subscribe((cfg) => {
      expect(docMock).toHaveBeenCalledWith(
        expect.any(Object),
        'users',
        'u1',
        'config',
        'default'
      );
      expect(cfg).toEqual({ dailyGoal: 123 });

      service.updateConfig('u1', { dailyGoal: 200 }).subscribe((updated) => {
        expect(setDocMock).toHaveBeenCalled();
        expect(updated).toEqual({ dailyGoal: 123 });
        done();
      });
    });
  });

  it('handles empty snapshot data', (done) => {
    getDocMock.mockResolvedValueOnce({ data: () => null });

    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const service = TestBed.inject(FirebaseUserConfigService);
    service.getConfig('u2').subscribe((cfg) => {
      expect(cfg).toEqual({});
      done();
    });
  });
});
