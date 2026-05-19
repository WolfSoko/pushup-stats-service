import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Analytics } from '@angular/fire/analytics';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { PushSubscriptionService } from '@pu-push/push';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { SettingsPageComponent } from './settings-page.component';
import { UserConfigStore } from '../../core/user-config.store';
import { ShareService } from '../../core/share.service';

const DEBOUNCE_MS = 600;
const SAVED_INDICATOR_MS = 1800;

describe('SettingsPageComponent — auto-save', () => {
  let fixture: ComponentFixture<SettingsPageComponent>;
  let component: SettingsPageComponent;
  let saveSpy: ReturnType<
    typeof vitest.fn<(patch: UserConfigUpdate) => Promise<UserConfig>>
  >;
  let configSignal: ReturnType<typeof signal<UserConfig>>;

  function setup(
    initial: UserConfig = { userId: 'u1', dailyGoal: 10 },
    saveImpl: (patch: UserConfigUpdate) => Promise<UserConfig> = (patch) =>
      Promise.resolve({ userId: 'u1', ...patch })
  ): void {
    configSignal = signal<UserConfig>(initial);
    saveSpy = vitest.fn(saveImpl);

    TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        {
          provide: UserConfigStore,
          useValue: {
            config: configSignal.asReadonly(),
            save: saveSpy,
            reload: vitest.fn(),
          },
        },
        {
          provide: UserContextService,
          useValue: {
            isGuest: signal(false),
            userIdSafe: signal('u1'),
          },
        },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
        provideRouter([]),
        { provide: Analytics, useValue: null },
        {
          provide: PushSubscriptionService,
          useValue: { unsubscribe: vitest.fn().mockResolvedValue(undefined) },
        },
        { provide: ShareService, useValue: { share: vitest.fn() } },
      ],
    });

    fixture = TestBed.createComponent(SettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    vitest.useRealTimers();
    TestBed.resetTestingModule();
  });

  async function flushMicrotasks(): Promise<void> {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }

  it('Given a clean form, When initialising, Then no save is triggered and status is idle', async () => {
    setup();
    await flushMicrotasks();
    fixture.detectChanges();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(component.saveStatus()).toBe('idle');
  });

  it('Given a draft change, When the debounce window elapses, Then save is called once with the new value', async () => {
    setup({ userId: 'u1', dailyGoal: 10 });
    vitest.useFakeTimers({ shouldAdvanceTime: true });

    await flushMicrotasks();
    component.dailyGoalDraft.set(42);
    fixture.detectChanges();

    expect(component.saveStatus()).toBe('pending');
    expect(saveSpy).not.toHaveBeenCalled();

    vitest.advanceTimersByTime(DEBOUNCE_MS);
    await flushMicrotasks();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({ dailyGoal: 42 })
    );
    expect(component.saveStatus()).toBe('saved');
  });

  it('Given multiple rapid draft changes, When the debounce window elapses, Then only one save fires with the final value', async () => {
    setup({ userId: 'u1', dailyGoal: 10 });
    vitest.useFakeTimers({ shouldAdvanceTime: true });

    await flushMicrotasks();
    component.dailyGoalDraft.set(11);
    fixture.detectChanges();
    vitest.advanceTimersByTime(DEBOUNCE_MS - 100);

    component.dailyGoalDraft.set(12);
    fixture.detectChanges();
    vitest.advanceTimersByTime(DEBOUNCE_MS - 100);

    component.dailyGoalDraft.set(13);
    fixture.detectChanges();
    vitest.advanceTimersByTime(DEBOUNCE_MS);
    await flushMicrotasks();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({ dailyGoal: 13 })
    );
  });

  it('Given a save fails, When the debounce fires, Then status transitions to error', async () => {
    const err = new Error('network down');
    setup({ userId: 'u1', dailyGoal: 10 }, () => Promise.reject(err));
    vitest.useFakeTimers({ shouldAdvanceTime: true });

    await flushMicrotasks();
    component.dailyGoalDraft.set(99);
    fixture.detectChanges();

    vitest.advanceTimersByTime(DEBOUNCE_MS);
    await flushMicrotasks();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(component.saveStatus()).toBe('error');
  });

  it('Given a saved status, When the indicator timeout elapses, Then status returns to idle', async () => {
    setup({ userId: 'u1', dailyGoal: 10 });
    vitest.useFakeTimers({ shouldAdvanceTime: true });

    await flushMicrotasks();
    component.dailyGoalDraft.set(11);
    fixture.detectChanges();

    vitest.advanceTimersByTime(DEBOUNCE_MS);
    await flushMicrotasks();
    expect(component.saveStatus()).toBe('saved');

    vitest.advanceTimersByTime(SAVED_INDICATOR_MS);
    await flushMicrotasks();

    expect(component.saveStatus()).toBe('idle');
  });

  it('Given the user is mid-edit, When a remote config update arrives, Then drafts retain the user input (no clobber)', async () => {
    setup({ userId: 'u1', dailyGoal: 10, displayName: 'Wolf' });
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    await flushMicrotasks();

    component.displayNameDraft.set('Wolf-edited');
    fixture.detectChanges();
    expect(component.saveStatus()).toBe('pending');

    // Simulate another tab/server pushing a new config while user is typing.
    configSignal.set({
      userId: 'u1',
      dailyGoal: 10,
      displayName: 'OtherDevice',
    });
    fixture.detectChanges();
    await flushMicrotasks();

    expect(component.displayNameDraft()).toBe('Wolf-edited');

    // The pending save still goes through with the user's draft.
    vitest.advanceTimersByTime(DEBOUNCE_MS);
    await flushMicrotasks();
    expect(saveSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({ displayName: 'Wolf-edited' })
    );
  });

  it('Given a pristine form, When a remote config update arrives, Then drafts pick up the new values without triggering a save', async () => {
    setup({ userId: 'u1', dailyGoal: 10 });
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    await flushMicrotasks();

    configSignal.set({ userId: 'u1', dailyGoal: 77 });
    fixture.detectChanges();
    await flushMicrotasks();

    expect(component.dailyGoalDraft()).toBe(77);
    expect(component.saveStatus()).toBe('idle');

    vitest.advanceTimersByTime(DEBOUNCE_MS);
    await flushMicrotasks();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('Given an error status, When retrySave is invoked, Then save is attempted again', async () => {
    let firstCall = true;
    setup({ userId: 'u1', dailyGoal: 10 }, (patch) => {
      if (firstCall) {
        firstCall = false;
        return Promise.reject(new Error('flaky'));
      }
      return Promise.resolve({ userId: 'u1', ...patch });
    });
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    await flushMicrotasks();

    component.dailyGoalDraft.set(33);
    fixture.detectChanges();
    vitest.advanceTimersByTime(DEBOUNCE_MS);
    await flushMicrotasks();

    expect(component.saveStatus()).toBe('error');
    expect(saveSpy).toHaveBeenCalledTimes(1);

    component.retrySave();
    await flushMicrotasks();

    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect(component.saveStatus()).toBe('saved');
  });

  it('Given a draft equal to the persisted snapshot, When set back to original after edit, Then no save is triggered', async () => {
    setup({ userId: 'u1', dailyGoal: 10 });
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    await flushMicrotasks();

    component.dailyGoalDraft.set(50);
    fixture.detectChanges();
    expect(component.saveStatus()).toBe('pending');

    component.dailyGoalDraft.set(10);
    fixture.detectChanges();

    vitest.advanceTimersByTime(DEBOUNCE_MS);
    await flushMicrotasks();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(component.saveStatus()).toBe('idle');
  });

  describe('displayName validation', () => {
    it('Given an invalid displayName, When the debounce elapses, Then no save fires and the error message is rendered', async () => {
      setup({ userId: 'u1', dailyGoal: 10, displayName: 'Alex' });
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      await flushMicrotasks();

      component.displayNameDraft.set('Wolf🚀');
      fixture.detectChanges();

      expect(component.displayNameViolation()).toBe('invalid-characters');
      expect(component.saveStatus()).toBe('pending');

      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await flushMicrotasks();

      expect(saveSpy).not.toHaveBeenCalled();

      const error = fixture.nativeElement.querySelector(
        '[data-testid="settings-displayname-error"]'
      ) as HTMLElement | null;
      expect(error).not.toBeNull();
    });

    it('Given a too-short displayName Then save is blocked', async () => {
      setup({ userId: 'u1', dailyGoal: 10, displayName: 'Alex' });
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      await flushMicrotasks();

      component.displayNameDraft.set('A');
      fixture.detectChanges();

      expect(component.displayNameViolation()).toBe('too-short');

      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await flushMicrotasks();

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('Given an invalid displayName edited to a valid one Then save fires', async () => {
      setup({ userId: 'u1', dailyGoal: 10, displayName: 'Alex' });
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      await flushMicrotasks();

      component.displayNameDraft.set('Wolf🚀');
      fixture.detectChanges();
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await flushMicrotasks();
      expect(saveSpy).not.toHaveBeenCalled();

      component.displayNameDraft.set('Wolf');
      fixture.detectChanges();
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await flushMicrotasks();

      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({ displayName: 'Wolf' })
      );
    });
  });
});
