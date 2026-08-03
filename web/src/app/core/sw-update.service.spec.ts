import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate } from '@angular/service-worker';
import { NEVER, Subject, of } from 'rxjs';
import {
  SW_UPDATE_POLL_INTERVAL_MS,
  SwUpdateService,
} from './sw-update.service';

interface SnackBarStub {
  onAction: () => unknown;
  afterDismissed: () => unknown;
}

describe('SwUpdateService', () => {
  let versionUpdates: Subject<{ type: string }>;
  let unrecoverable: Subject<{ type: string; reason: string }>;
  let swUpdateMock: {
    versionUpdates: ReturnType<Subject<{ type: string }>['asObservable']>;
    unrecoverable: ReturnType<
      Subject<{ type: string; reason: string }>['asObservable']
    >;
    isEnabled: boolean;
    activateUpdate: ReturnType<typeof vitest.fn>;
    checkForUpdate: ReturnType<typeof vitest.fn>;
  };
  let openSpy: ReturnType<typeof stubSnackBar>;
  let onActionSubject: Subject<void>;
  let afterDismissedSubject: Subject<{ dismissedByAction: boolean }>;
  let reloadSpy: ReturnType<typeof vitest.fn>;

  function stubSnackBar(overrides: Partial<SnackBarStub> = {}) {
    return vitest.spyOn(MatSnackBar.prototype, 'open').mockReturnValue({
      onAction: () => onActionSubject.asObservable(),
      afterDismissed: () => afterDismissedSubject.asObservable(),
      ...overrides,
    } as unknown as ReturnType<MatSnackBar['open']>);
  }

  function createService(platform: 'browser' | 'server' = 'browser') {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        { provide: SwUpdate, useValue: swUpdateMock },
      ],
    });
    return TestBed.inject(SwUpdateService);
  }

  function updateCalls() {
    return openSpy.mock.calls.filter(([, action]) => action === 'Neu laden');
  }

  beforeEach(() => {
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    onActionSubject = new Subject();
    afterDismissedSubject = new Subject();
    swUpdateMock = {
      versionUpdates: versionUpdates.asObservable(),
      unrecoverable: unrecoverable.asObservable(),
      isEnabled: true,
      activateUpdate: vitest.fn().mockResolvedValue(true),
      checkForUpdate: vitest.fn().mockResolvedValue(true),
    };
    reloadSpy = vitest.fn();
    vitest
      .spyOn(window, 'location', 'get')
      .mockReturnValue({ reload: reloadSpy } as unknown as Location);
    openSpy = stubSnackBar();
  });

  afterEach(() => {
    vitest.restoreAllMocks();
  });

  it('should show the actionable reload snackbar on VERSION_READY', () => {
    // given
    const service = createService();

    // when
    versionUpdates.next({ type: 'VERSION_READY' });

    // then
    expect(updateCalls()).toHaveLength(1);
    expect(updateCalls()[0][0]).toBe('Neue Version verfügbar');
    expect(service.updateAvailable()).toBe(true);
  });

  // Regression: a 20s auto-dismiss + bottom anchor meant the prompt was easy
  // to miss (mobile bottom-nav clipped it; tabbing away wiped it).
  it('should open the prompt sticky at top-center with the sw-update panelClass', () => {
    // given
    createService();

    // when
    versionUpdates.next({ type: 'VERSION_READY' });

    // then
    const config = updateCalls()[0][2];
    expect(config?.duration).toBeUndefined();
    expect(config?.horizontalPosition).toBe('center');
    expect(config?.verticalPosition).toBe('top');
    expect(config?.panelClass).toBe('sw-update-snackbar');
  });

  // Regression: a non-actionable "downloading in background" toast used to
  // fire on VERSION_DETECTED, visually replacing the actionable reload toast
  // and leaving users with no way to apply the update.
  it('should not prompt on VERSION_DETECTED', () => {
    // given
    const service = createService();

    // when
    versionUpdates.next({ type: 'VERSION_DETECTED' });

    // then
    expect(updateCalls()).toHaveLength(0);
    expect(service.updateAvailable()).toBe(false);
  });

  // Regression: a plain `location.reload()` does not skip the waiting ngsw,
  // so users would tap "Neu laden" and still get the old build.
  it('should activate the waiting worker before reloading on Neu laden', async () => {
    // given
    createService();
    versionUpdates.next({ type: 'VERSION_READY' });

    // when
    onActionSubject.next();
    await Promise.resolve();
    await Promise.resolve();

    // then
    expect(swUpdateMock.activateUpdate).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(
      swUpdateMock.activateUpdate.mock.invocationCallOrder[0]
    ).toBeLessThan(reloadSpy.mock.invocationCallOrder[0]);
  });

  // Regression: the whole point of the fix — `MatSnackBar` is a singleton, so
  // any routine toast dismisses the sticky reload prompt, and VERSION_READY
  // never fires twice. The latched signal is what keeps the notice reachable.
  it('should keep updateAvailable set after the snackbar is dismissed by another toast', () => {
    // given
    const service = createService();
    versionUpdates.next({ type: 'VERSION_READY' });

    // when
    afterDismissedSubject.next({ dismissedByAction: false });

    // then
    expect(service.updateAvailable()).toBe(true);
  });

  it('should re-open the prompt when the user returns to a backgrounded tab', () => {
    // given
    createService();
    versionUpdates.next({ type: 'VERSION_READY' });
    afterDismissedSubject.next({ dismissedByAction: false });
    vitest
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible' as DocumentVisibilityState);

    // when
    document.dispatchEvent(new Event('visibilitychange'));

    // then
    expect(updateCalls()).toHaveLength(2);
    expect(swUpdateMock.checkForUpdate).not.toHaveBeenCalled();
  });

  it('should not stack a second prompt while one is still on screen', () => {
    // given
    createService();
    versionUpdates.next({ type: 'VERSION_READY' });
    vitest
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible' as DocumentVisibilityState);

    // when
    document.dispatchEvent(new Event('visibilitychange'));

    // then
    expect(updateCalls()).toHaveLength(1);
  });

  it('should check for an update when a hidden tab becomes visible again', () => {
    // given
    createService();
    vitest
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible' as DocumentVisibilityState);

    // when
    document.dispatchEvent(new Event('visibilitychange'));

    // then
    expect(swUpdateMock.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('should ignore a visibilitychange that hides the tab', () => {
    // given
    createService();
    vitest
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden' as DocumentVisibilityState);

    // when
    document.dispatchEvent(new Event('visibilitychange'));

    // then
    expect(swUpdateMock.checkForUpdate).not.toHaveBeenCalled();
  });

  // Regression: long-lived PWA/TWA sessions never received the reload toast
  // because ngsw only checked the manifest once at app start.
  it('should poll checkForUpdate every 10 minutes', () => {
    // given
    vitest.useFakeTimers();
    try {
      createService();
      expect(swUpdateMock.checkForUpdate).not.toHaveBeenCalled();

      // when
      vitest.advanceTimersByTime(SW_UPDATE_POLL_INTERVAL_MS);

      // then
      expect(swUpdateMock.checkForUpdate).toHaveBeenCalledTimes(1);

      vitest.advanceTimersByTime(2 * SW_UPDATE_POLL_INTERVAL_MS);
      expect(swUpdateMock.checkForUpdate).toHaveBeenCalledTimes(3);
    } finally {
      vitest.useRealTimers();
    }
  });

  it('should survive a rejected checkForUpdate', () => {
    // given
    vitest.useFakeTimers();
    swUpdateMock.checkForUpdate = vitest
      .fn()
      .mockRejectedValue(new Error('offline'));
    try {
      createService();

      // when
      vitest.advanceTimersByTime(2 * SW_UPDATE_POLL_INTERVAL_MS);

      // then
      expect(swUpdateMock.checkForUpdate).toHaveBeenCalledTimes(2);
    } finally {
      vitest.useRealTimers();
    }
  });

  it('should prompt with the corrupted-cache message on UNRECOVERABLE_STATE', () => {
    // given
    const service = createService();

    // when
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'gone' });

    // then
    expect(updateCalls()).toHaveLength(1);
    expect(updateCalls()[0][0]).toBe('App-Daten beschädigt – bitte neu laden');
    expect(service.unrecoverable()).toBe(true);
    expect(service.updateAvailable()).toBe(true);
  });

  it('should still reload when activateUpdate rejects', async () => {
    // given
    swUpdateMock.activateUpdate = vitest
      .fn()
      .mockRejectedValue(new Error('no waiting worker'));
    const service = createService();

    // when
    await service.applyUpdate();

    // then
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('should stay inert during SSR', () => {
    // given
    openSpy = stubSnackBar({
      onAction: () => NEVER,
      afterDismissed: () => of({}),
    });

    // when
    const service = createService('server');
    versionUpdates.next({ type: 'VERSION_READY' });

    // then
    expect(service.updateAvailable()).toBe(false);
    expect(updateCalls()).toHaveLength(0);
  });

  it('should stay inert when the service worker is disabled', () => {
    // given
    swUpdateMock.isEnabled = false;

    // when
    const service = createService();
    versionUpdates.next({ type: 'VERSION_READY' });

    // then
    expect(service.updateAvailable()).toBe(false);
    expect(updateCalls()).toHaveLength(0);
  });
});
