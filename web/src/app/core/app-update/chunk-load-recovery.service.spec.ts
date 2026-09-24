import { Component, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  CHUNK_RELOAD_MIN_INTERVAL_MS,
  CHUNK_RELOAD_STORAGE_KEY,
  ChunkLoadRecoveryService,
  isChunkLoadError,
} from './chunk-load-recovery.service';
import { PageReloadService } from './page-reload.service';

@Component({ template: '' })
class BlankComponent {}

describe('isChunkLoadError', () => {
  it.each([
    new TypeError(
      'Failed to fetch dynamically imported module: https://x/chunk-A.js'
    ),
    new TypeError('error loading dynamically imported module'),
    new TypeError('Importing a module script failed.'),
    Object.assign(new Error('Loading chunk 42 failed.'), {
      name: 'ChunkLoadError',
    }),
  ])('should recognise %s', (error) => {
    // given / when / then
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('should not treat other errors as chunk errors', () => {
    // given / when / then
    expect(isChunkLoadError(new Error('Permission denied'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('ChunkLoadRecoveryService', () => {
  let reload: ReturnType<typeof vitest.fn>;
  let loadError: Error;

  beforeEach(() => {
    sessionStorage.clear();
    reload = vitest.fn().mockResolvedValue(undefined);
    loadError = new TypeError(
      'Failed to fetch dynamically imported module: /chunk-old.js'
    );
  });

  async function setup(platform = 'browser') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: BlankComponent },
          { path: 'lazy', loadComponent: () => Promise.reject(loadError) },
        ]),
        { provide: PLATFORM_ID, useValue: platform },
        { provide: PageReloadService, useValue: { reload } },
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    TestBed.inject(ChunkLoadRecoveryService);
    return router;
  }

  it('should reload into the target when a lazy chunk fails to load', async () => {
    // given
    const router = await setup();

    // when
    await router.navigateByUrl('/lazy').catch(() => undefined);

    // then
    expect(reload).toHaveBeenCalledWith('/lazy');
  });

  it('should not reload again within the loop-protection window', async () => {
    // given
    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now()));
    const router = await setup();

    // when
    await router.navigateByUrl('/lazy').catch(() => undefined);

    // then
    expect(reload).not.toHaveBeenCalled();
  });

  it('should reload again once the loop-protection window has passed', async () => {
    // given
    sessionStorage.setItem(
      CHUNK_RELOAD_STORAGE_KEY,
      String(Date.now() - CHUNK_RELOAD_MIN_INTERVAL_MS - 1)
    );
    const router = await setup();

    // when
    await router.navigateByUrl('/lazy').catch(() => undefined);

    // then
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('should not reload when the loop protection cannot be stored', async () => {
    // given
    const setItem = vitest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
    const router = await setup();

    // when
    await router.navigateByUrl('/lazy').catch(() => undefined);

    // then
    expect(reload).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('should ignore navigation errors that are not chunk failures', async () => {
    // given
    loadError = new Error('Permission denied');
    const router = await setup();

    // when
    await router.navigateByUrl('/lazy').catch(() => undefined);

    // then
    expect(reload).not.toHaveBeenCalled();
  });

  it('should do nothing during SSR', async () => {
    // given
    const router = await setup('server');

    // when
    await router.navigateByUrl('/lazy').catch(() => undefined);

    // then
    expect(reload).not.toHaveBeenCalled();
  });
});
