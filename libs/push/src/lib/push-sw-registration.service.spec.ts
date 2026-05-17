import { LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  buildPushSwPaths,
  PushSwRegistrationService,
} from './push-sw-registration.service';

function setup(options?: {
  platform?: 'browser' | 'server';
  locale?: string;
  serviceWorker?: {
    getRegistration?: jest.Mock;
    register?: jest.Mock;
  } | null;
}): { service: PushSwRegistrationService; swDescriptor?: PropertyDescriptor } {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'serviceWorker'
  );

  if (options?.serviceWorker === null) {
    delete (navigator as Record<string, unknown>)['serviceWorker'];
  } else if (options?.serviceWorker) {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: options.serviceWorker,
      configurable: true,
      writable: true,
    });
  }

  TestBed.configureTestingModule({
    providers: [
      {
        provide: PLATFORM_ID,
        useValue: options?.platform === 'server' ? 'server' : 'browser',
      },
      { provide: LOCALE_ID, useValue: options?.locale ?? 'de' },
    ],
  });

  const service = TestBed.inject(PushSwRegistrationService);
  return { service, swDescriptor: originalDescriptor };
}

function restoreServiceWorker(descriptor?: PropertyDescriptor): void {
  if (descriptor) {
    Object.defineProperty(navigator, 'serviceWorker', descriptor);
  } else {
    delete (navigator as Record<string, unknown>)['serviceWorker'];
  }
}

describe('PushSwRegistrationService', () => {
  let descriptorToRestore: PropertyDescriptor | undefined;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreServiceWorker(descriptorToRestore);
    descriptorToRestore = undefined;
    errorSpy.mockRestore();
    TestBed.resetTestingModule();
  });

  it('returns undefined during SSR (platform server)', async () => {
    const { service, swDescriptor } = setup({ platform: 'server' });
    descriptorToRestore = swDescriptor;

    await expect(service.getRegistration()).resolves.toBeUndefined();
  });

  it('returns undefined when navigator.serviceWorker is missing', async () => {
    const { service, swDescriptor } = setup({ serviceWorker: null });
    descriptorToRestore = swDescriptor;

    await expect(service.getRegistration()).resolves.toBeUndefined();
  });

  it('returns undefined when navigator.serviceWorker is a partial stub (no register)', async () => {
    // Regression for Nx Cloud web:test flake: jsdom exposed `serviceWorker`
    // as an object without a real `register` method, which previously caused
    // the eager afterNextRender() hook in app.ts to throw.
    const { service, swDescriptor } = setup({
      serviceWorker: {
        getRegistration: jest.fn().mockResolvedValue(undefined),
        // No `register` key at all.
      },
    });
    descriptorToRestore = swDescriptor;

    await expect(service.getRegistration()).resolves.toBeUndefined();
  });

  it('returns the existing registration from the fast path without calling register()', async () => {
    const existing = {
      scope: 'https://example.com/push/',
    } as unknown as ServiceWorkerRegistration;
    const register = jest.fn();
    const { service, swDescriptor } = setup({
      serviceWorker: {
        getRegistration: jest.fn().mockResolvedValue(existing),
        register,
      },
    });
    descriptorToRestore = swDescriptor;

    await expect(service.getRegistration()).resolves.toBe(existing);
    expect(register).not.toHaveBeenCalled();
  });

  it('calls register() with locale-prefixed path + scope when no existing registration', async () => {
    const fresh = {
      scope: 'https://example.com/de/push/',
    } as unknown as ServiceWorkerRegistration;
    const register = jest.fn().mockResolvedValue(fresh);
    const { service, swDescriptor } = setup({
      locale: 'de',
      serviceWorker: {
        getRegistration: jest.fn().mockResolvedValue(undefined),
        register,
      },
    });
    descriptorToRestore = swDescriptor;

    const reg = await service.getRegistration();
    expect(reg).toBe(fresh);
    expect(register).toHaveBeenCalledWith(
      '/de/push/sw-push.js',
      expect.objectContaining({ scope: '/de/push/' })
    );
  });

  it('uses the English locale prefix when LOCALE_ID starts with "en"', async () => {
    const register = jest
      .fn()
      .mockResolvedValue({} as ServiceWorkerRegistration);
    const { service, swDescriptor } = setup({
      locale: 'en-US',
      serviceWorker: {
        getRegistration: jest.fn().mockResolvedValue(undefined),
        register,
      },
    });
    descriptorToRestore = swDescriptor;

    await service.getRegistration();
    expect(register).toHaveBeenCalledWith(
      '/en/push/sw-push.js',
      expect.objectContaining({ scope: '/en/push/' })
    );
  });

  it('buildPushSwPaths falls back to "de" for unrecognised locales', () => {
    expect(buildPushSwPaths('fr')).toEqual({
      path: '/de/push/sw-push.js',
      scope: '/de/push/',
    });
  });

  it('memoises register() across concurrent callers (only one register() fires)', async () => {
    const fresh = {} as unknown as ServiceWorkerRegistration;
    let resolveRegister: (r: ServiceWorkerRegistration) => void = () => {
      // replaced below
    };
    const registerPromise = new Promise<ServiceWorkerRegistration>((r) => {
      resolveRegister = r;
    });
    const register = jest.fn().mockReturnValue(registerPromise);
    const { service, swDescriptor } = setup({
      serviceWorker: {
        getRegistration: jest.fn().mockResolvedValue(undefined),
        register,
      },
    });
    descriptorToRestore = swDescriptor;

    const [p1, p2, p3] = [
      service.getRegistration(),
      service.getRegistration(),
      service.getRegistration(),
    ];
    resolveRegister(fresh);
    await expect(Promise.all([p1, p2, p3])).resolves.toEqual([
      fresh,
      fresh,
      fresh,
    ]);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('returns undefined if register() rejects and logs the error (next call may retry)', async () => {
    const register = jest
      .fn()
      .mockRejectedValueOnce(new Error('install failed'))
      // second call (after the failure) succeeds
      .mockResolvedValueOnce({} as ServiceWorkerRegistration);
    const { service, swDescriptor } = setup({
      serviceWorker: {
        getRegistration: jest.fn().mockResolvedValue(undefined),
        register,
      },
    });
    descriptorToRestore = swDescriptor;

    const first = await service.getRegistration();
    expect(first).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();

    // A later call clears the memoised failure and retries.
    const second = await service.getRegistration();
    expect(second).toBeDefined();
    expect(register).toHaveBeenCalledTimes(2);
  });

  it('times out to undefined if register() never resolves (15s cap)', async () => {
    jest.useFakeTimers();
    try {
      const register = jest.fn().mockReturnValue(new Promise(() => undefined));
      const { service, swDescriptor } = setup({
        serviceWorker: {
          getRegistration: jest.fn().mockResolvedValue(undefined),
          register,
        },
      });
      descriptorToRestore = swDescriptor;

      const promise = service.getRegistration();
      // Advance past the 15 s timeout.
      await jest.advanceTimersByTimeAsync(16_000);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });
});
