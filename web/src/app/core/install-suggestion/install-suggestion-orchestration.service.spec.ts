import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { InstallPromptService } from '../install-prompt.service';
import { INSTALL_SUGGESTION_SNOOZE_KEY } from './install-suggestion';
import { InstallSuggestionDialogComponent } from './install-suggestion-dialog.component';
import {
  INSTALL_SUGGESTION_DELAY_MS,
  InstallSuggestionOrchestrationService,
} from './install-suggestion-orchestration.service';

describe('InstallSuggestionOrchestrationService', () => {
  let events: Subject<NavigationEnd>;
  let afterClosed: Subject<unknown>;
  let open: ReturnType<typeof vi.fn>;
  let openDialogs: unknown[];
  let installPrompt: {
    isStandalone: ReturnType<typeof signal<boolean>>;
    canInstall: ReturnType<typeof signal<boolean>>;
    isAndroid: boolean;
    isIos: boolean;
    hasInstalledAndroidApp: ReturnType<typeof vi.fn>;
  };

  function setup(
    options: {
      url?: string;
      platform?: string;
      isAndroid?: boolean;
      isIos?: boolean;
      canInstall?: boolean;
      standalone?: boolean;
      androidAppInstalled?: boolean;
    } = {}
  ): void {
    events = new Subject();
    afterClosed = new Subject();
    openDialogs = [];
    open = vi.fn(() => ({ afterClosed: () => afterClosed }));
    installPrompt = {
      isStandalone: signal(options.standalone ?? false),
      canInstall: signal(options.canInstall ?? false),
      isAndroid: options.isAndroid ?? false,
      isIos: options.isIos ?? false,
      hasInstalledAndroidApp: vi
        .fn()
        .mockResolvedValue(options.androidAppInstalled ?? false),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
        { provide: MatDialog, useValue: { open, openDialogs } },
        { provide: Router, useValue: { events, url: options.url ?? '/app' } },
        { provide: InstallPromptService, useValue: installPrompt },
      ],
    });
    TestBed.inject(InstallSuggestionOrchestrationService);
    TestBed.tick();
  }

  async function elapse(ms = INSTALL_SUGGESTION_DELAY_MS): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T10:00:00.000Z'));
    localStorage.removeItem(INSTALL_SUGGESTION_SNOOZE_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem(INSTALL_SUGGESTION_SNOOZE_KEY);
  });

  it('should suggest the Play Store app on Android after the delay', async () => {
    // given
    setup({ isAndroid: true });
    // when
    await elapse(INSTALL_SUGGESTION_DELAY_MS - 1);
    expect(open).not.toHaveBeenCalled();
    await elapse(1);
    // then
    expect(open).toHaveBeenCalledWith(
      InstallSuggestionDialogComponent,
      expect.objectContaining({ data: { variant: 'play-store' } })
    );
  });

  it('should suggest the PWA install once the browser offers it', async () => {
    // given
    setup({ canInstall: false });
    // when
    installPrompt.canInstall.set(true);
    TestBed.tick();
    await elapse();
    // then
    expect(open).toHaveBeenCalledWith(
      InstallSuggestionDialogComponent,
      expect.objectContaining({ data: { variant: 'pwa' } })
    );
  });

  it('should explain the home-screen steps on iOS', async () => {
    // given
    setup({ isIos: true });
    // when
    await elapse();
    // then
    expect(open).toHaveBeenCalledWith(
      InstallSuggestionDialogComponent,
      expect.objectContaining({ data: { variant: 'ios' } })
    );
  });

  it('should stay silent inside the installed app', async () => {
    // given
    setup({ isAndroid: true, standalone: true });
    // when
    await elapse();
    // then
    expect(open).not.toHaveBeenCalled();
  });

  it('should stay silent when the Android app is already installed', async () => {
    // given
    setup({ isAndroid: true, androidAppInstalled: true });
    // when
    await elapse();
    // then
    expect(open).not.toHaveBeenCalled();
  });

  it('should stay silent outside the dashboard', async () => {
    // given
    setup({ isAndroid: true, url: '/login' });
    // when
    await elapse();
    // then
    expect(open).not.toHaveBeenCalled();
  });

  it('should skip the session when another dialog is already open', async () => {
    // given
    setup({ isAndroid: true });
    openDialogs.push({});
    // when
    await elapse();
    openDialogs.length = 0;
    events.next(new NavigationEnd(2, '/de/app', '/de/app'));
    TestBed.tick();
    await elapse();
    // then
    expect(open).not.toHaveBeenCalled();
  });

  it('should wait for the next dashboard visit when the user left before the delay', async () => {
    // given
    setup({ isAndroid: true });
    events.next(new NavigationEnd(2, '/stats', '/stats'));
    TestBed.tick();
    await elapse();
    expect(open).not.toHaveBeenCalled();
    // when
    events.next(new NavigationEnd(3, '/app', '/app'));
    TestBed.tick();
    await elapse();
    // then
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('should suggest only once per session', async () => {
    // given
    setup({ isAndroid: true });
    await elapse();
    // when
    events.next(new NavigationEnd(2, '/stats', '/stats'));
    events.next(new NavigationEnd(3, '/app', '/app'));
    TestBed.tick();
    await elapse();
    // then
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('should snooze on this device once the dialog closes', async () => {
    // given
    setup({ isAndroid: true });
    await elapse();
    // when
    afterClosed.next('installing');
    // then
    expect(localStorage.getItem(INSTALL_SUGGESTION_SNOOZE_KEY)).toBe(
      '2026-12-25T10:00:20.000Z'
    );
  });

  it('should treat closing via backdrop as a dismissal', async () => {
    // given
    setup({ isAndroid: true });
    await elapse();
    // when
    afterClosed.next(undefined);
    // then
    expect(localStorage.getItem(INSTALL_SUGGESTION_SNOOZE_KEY)).toBe(
      '2026-10-10T10:00:20.000Z'
    );
  });

  it('should stay silent while a snooze is active', async () => {
    // given
    localStorage.setItem(
      INSTALL_SUGGESTION_SNOOZE_KEY,
      '2026-10-01T00:00:00.000Z'
    );
    setup({ isAndroid: true });
    // when
    await elapse();
    // then
    expect(open).not.toHaveBeenCalled();
  });

  it('should do nothing on the server', async () => {
    // given
    setup({ isAndroid: true, platform: 'server' });
    // when
    await elapse();
    // then
    expect(open).not.toHaveBeenCalled();
  });
});
