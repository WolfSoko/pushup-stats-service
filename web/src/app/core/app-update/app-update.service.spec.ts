import { Component, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { blocksAppUpdateData } from './app-update-route-data';
import {
  APP_UPDATE_CHECK_THROTTLE_MS,
  APP_UPDATE_POLL_INTERVAL_MS,
  AppUpdateService,
} from './app-update.service';
import { AppUpdateStore } from './app-update.store';
import { PageReloadService } from './page-reload.service';

@Component({ template: '' })
class BlankComponent {}

const versionReady = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'old' },
  latestVersion: { hash: 'new' },
} as VersionEvent;

describe('AppUpdateService', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<unknown>;
  let swUpdate: {
    isEnabled: boolean;
    versionUpdates: Subject<VersionEvent>;
    unrecoverable: Subject<unknown>;
    checkForUpdate: ReturnType<typeof vitest.fn>;
  };
  let reload: ReturnType<typeof vitest.fn>;
  let openDialogs: unknown[];

  beforeEach(() => {
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    swUpdate = {
      isEnabled: true,
      versionUpdates,
      unrecoverable,
      checkForUpdate: vitest.fn().mockResolvedValue(false),
    };
    reload = vitest.fn().mockResolvedValue(undefined);
    openDialogs = [];
  });

  afterEach(() => {
    vitest.useRealTimers();
  });

  async function setup(options: { platform?: string; startUrl?: string } = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: BlankComponent },
          { path: 'history', component: BlankComponent },
          {
            path: 'workouts/:id/run',
            component: BlankComponent,
            data: blocksAppUpdateData,
          },
        ]),
        { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
        { provide: SwUpdate, useValue: swUpdate },
        { provide: PageReloadService, useValue: { reload } },
        { provide: MatDialog, useValue: { openDialogs } },
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(options.startUrl ?? '/');
    const service = TestBed.inject(AppUpdateService);
    return { service, router, store: TestBed.inject(AppUpdateStore) };
  }

  function becomeVisible(): void {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('should mark the update ready on VERSION_READY', async () => {
    // given
    const { store } = await setup();

    // when
    versionUpdates.next(versionReady);

    // then
    expect(store.status()).toBe('ready');
  });

  it('should ignore VERSION_DETECTED because the download is not finished', async () => {
    // given
    const { store } = await setup();

    // when
    versionUpdates.next({
      type: 'VERSION_DETECTED',
      version: { hash: 'new' },
    } as VersionEvent);

    // then
    expect(store.status()).toBe('current');
  });

  it('should mark the state unrecoverable when ngsw loses its cache', async () => {
    // given
    const { store } = await setup();

    // when
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'gone' });

    // then
    expect(store.status()).toBe('unrecoverable');
  });

  it('should do nothing during SSR', async () => {
    // given
    const { store } = await setup({ platform: 'server' });

    // when
    versionUpdates.next(versionReady);

    // then
    expect(store.status()).toBe('current');
  });

  it('should poll for updates on the interval', async () => {
    // given
    vitest.useFakeTimers();
    await setup();

    // when
    vitest.advanceTimersByTime(APP_UPDATE_POLL_INTERVAL_MS);

    // then
    expect(swUpdate.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('should throttle checks triggered by returning to the app', async () => {
    // given
    vitest.useFakeTimers();
    await setup();
    vitest.advanceTimersByTime(APP_UPDATE_CHECK_THROTTLE_MS);

    // when
    becomeVisible();
    becomeVisible();

    // then
    expect(swUpdate.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('should not check again while an update is already pending', async () => {
    // given
    vitest.useFakeTimers();
    await setup();
    versionUpdates.next(versionReady);

    // when
    vitest.advanceTimersByTime(APP_UPDATE_POLL_INTERVAL_MS);

    // then
    expect(swUpdate.checkForUpdate).not.toHaveBeenCalled();
  });

  it('should reload into the navigation target while an update is pending', async () => {
    // given
    const { router } = await setup();
    versionUpdates.next(versionReady);

    // when
    await router.navigateByUrl('/history');

    // then
    expect(reload).toHaveBeenCalledWith('/history');
  });

  it('should not reload when only query params change', async () => {
    // given
    const { router } = await setup({ startUrl: '/history' });
    versionUpdates.next(versionReady);

    // when
    await router.navigateByUrl('/history?range=week');

    // then
    expect(reload).not.toHaveBeenCalled();
  });

  it('should navigate normally while no update is pending', async () => {
    // given
    const { router } = await setup();

    // when
    await router.navigateByUrl('/history');

    // then
    expect(reload).not.toHaveBeenCalled();
  });

  it('should not reload when leaving a route that blocks updates', async () => {
    // given
    const { router, store } = await setup({ startUrl: '/workouts/w1/run' });
    versionUpdates.next(versionReady);

    // when
    await router.navigateByUrl('/history');

    // then
    expect(store.routeBlocksUpdate()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('should flag a blocking route in the store', async () => {
    // given
    const { router, store } = await setup();

    // when
    await router.navigateByUrl('/workouts/w1/run');

    // then
    expect(store.routeBlocksUpdate()).toBe(true);
  });

  it('should not reload while a dialog is open', async () => {
    // given
    const { router } = await setup();
    versionUpdates.next(versionReady);
    openDialogs.push({});

    // when
    await router.navigateByUrl('/history');

    // then
    expect(reload).not.toHaveBeenCalled();
  });
});
