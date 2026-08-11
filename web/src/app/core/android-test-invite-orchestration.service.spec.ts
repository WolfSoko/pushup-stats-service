import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { UserConfig } from '@pu-stats/models';
import { AndroidTestInviteOrchestrationService } from './android-test-invite-orchestration.service';
import { UserConfigStore } from './user-config.store';

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

describe('AndroidTestInviteOrchestrationService', () => {
  const dialogOpenSpy = vitest
    .fn()
    .mockReturnValue({} as unknown as MatDialogRef<unknown>);
  const dialogMock = { open: dialogOpenSpy } as unknown as MatDialog;

  const configSignal = signal<UserConfig | null>(null);
  const userConfigStoreMock = { config: configSignal.asReadonly() };

  function setNavigator(userAgent: string, referrer: string): void {
    Object.defineProperty(navigator, 'userAgent', {
      value: userAgent,
      configurable: true,
    });
    Object.defineProperty(document, 'referrer', {
      value: referrer,
      configurable: true,
    });
  }

  function setup(): AndroidTestInviteOrchestrationService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: dialogMock },
        { provide: UserConfigStore, useValue: userConfigStoreMock },
      ],
    });
    return TestBed.inject(AndroidTestInviteOrchestrationService);
  }

  beforeEach(() => {
    dialogOpenSpy.mockClear();
    configSignal.set(null);
    setNavigator(ANDROID_UA, 'https://pushup-stats.com/');
  });

  it('should open the invite dialog for a confirmed candidate on Android outside the TWA', () => {
    // given
    setup();
    // when
    configSignal.set({
      userId: 'u1',
      androidTest: { status: 'confirmed' },
    } as UserConfig);
    TestBed.tick();
    // then
    expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
  });

  it('should not open the dialog when the candidate has not been confirmed', () => {
    // given
    setup();
    // when
    configSignal.set({
      userId: 'u1',
      androidTest: { status: 'candidate' },
    } as UserConfig);
    TestBed.tick();
    // then
    expect(dialogOpenSpy).not.toHaveBeenCalled();
  });

  it('should not open the dialog on a non-Android device', () => {
    // given
    setup();
    setNavigator(DESKTOP_UA, 'https://pushup-stats.com/');
    // when
    configSignal.set({
      userId: 'u1',
      androidTest: { status: 'confirmed' },
    } as UserConfig);
    TestBed.tick();
    // then
    expect(dialogOpenSpy).not.toHaveBeenCalled();
  });

  it('should not open the dialog when already running inside the installed TWA', () => {
    // given
    setup();
    setNavigator(ANDROID_UA, 'android-app://com.pushupstats.app');
    // when
    configSignal.set({
      userId: 'u1',
      androidTest: { status: 'confirmed' },
    } as UserConfig);
    TestBed.tick();
    // then
    expect(dialogOpenSpy).not.toHaveBeenCalled();
  });

  it('should not open the dialog while the popup snooze is still in the future', () => {
    // given
    setup();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    // when
    configSignal.set({
      userId: 'u1',
      androidTest: { status: 'confirmed' },
      ui: { androidTestPopupDismissedUntil: future },
    } as UserConfig);
    TestBed.tick();
    // then
    expect(dialogOpenSpy).not.toHaveBeenCalled();
  });

  it('should open the dialog once the popup snooze has expired', () => {
    // given
    setup();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // when
    configSignal.set({
      userId: 'u1',
      androidTest: { status: 'confirmed' },
      ui: { androidTestPopupDismissedUntil: past },
    } as UserConfig);
    TestBed.tick();
    // then
    expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
  });

  it('should only open the dialog once per session even if the config signal re-emits', () => {
    // given
    setup();
    configSignal.set({
      userId: 'u1',
      androidTest: { status: 'confirmed' },
    } as UserConfig);
    TestBed.tick();
    // when
    configSignal.set({
      userId: 'u1',
      androidTest: { status: 'confirmed' },
      displayName: 'changed',
    } as UserConfig);
    TestBed.tick();
    // then
    expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
  });
});
