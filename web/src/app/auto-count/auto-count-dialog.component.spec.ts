import { PLATFORM_ID, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  type FormCheckFrame,
  PROXIMITY_REP_COUNTER,
  REP_COUNTER,
  type RepCountSnapshot,
} from '@pu-stats/auto-count';
import { UserContextService } from '@pu-auth/auth';

import { AutoCountFeedbackFlow } from './auto-count-feedback.flow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AutoCountDialogComponent } from './auto-count-dialog.component';
import { CameraService } from './camera.service';

const INITIAL_SNAPSHOT: RepCountSnapshot = {
  count: 0,
  phase: 'awaiting-up',
  lastRepAtMs: null,
};

const flushAsync = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

const makeCounter = (
  state = signal<RepCountSnapshot>(INITIAL_SNAPSHOT),
  frame: WritableSignal<FormCheckFrame | null> = signal<FormCheckFrame | null>(
    null
  )
) => {
  const isActive = signal(false);
  const start = vi.fn(async () => {
    isActive.set(true);
  });
  const stop = vi.fn(async () => {
    isActive.set(false);
    frame.set(null);
  });
  const bind = vi.fn();
  return {
    snapshot: state.asReadonly(),
    isActive: isActive.asReadonly(),
    formCheckFrame: frame.asReadonly(),
    bindVideoElement: bind,
    start,
    stop,
    reset: vi.fn(),
    startSpy: start,
    stopSpy: stop,
    bindSpy: bind,
    frame,
  };
};

/** Only the slice of the auth surface the tuning store reads. */
const makeUserContext = (isAdmin = false) => ({
  isAdmin: () => isAdmin,
  userIdSafe: () => 'admin-uid',
  isGuest: () => false,
});

describe('AutoCountDialogComponent', () => {
  let userContext: ReturnType<typeof makeUserContext>;
  let state: WritableSignal<RepCountSnapshot>;
  let shouldAsk: boolean;
  let feedbackRecord: ReturnType<typeof vi.fn>;
  let feedbackDisable: ReturnType<typeof vi.fn>;
  let counter: ReturnType<typeof makeCounter>;
  let proximity: ReturnType<typeof makeCounter>;
  let cameraOpen: ReturnType<typeof vi.fn>;
  let cameraClose: ReturnType<typeof vi.fn>;
  let dialogClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state = signal<RepCountSnapshot>(INITIAL_SNAPSHOT);
    counter = makeCounter(state);
    proximity = makeCounter();
    shouldAsk = true;
    feedbackRecord = vi.fn().mockResolvedValue(undefined);
    feedbackDisable = vi.fn();
    cameraOpen = vi.fn().mockResolvedValue(undefined);
    cameraClose = vi.fn().mockResolvedValue(undefined);
    dialogClose = vi.fn();
    userContext = makeUserContext();

    TestBed.configureTestingModule({
      imports: [AutoCountDialogComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: CameraService,
          useValue: { open: cameraOpen, close: cameraClose },
        },
        {
          provide: MatDialogRef,
          useValue: { close: dialogClose },
        },
        { provide: REP_COUNTER, useValue: counter },
        { provide: PROXIMITY_REP_COUNTER, useValue: proximity },
        { provide: UserContextService, useValue: userContext },
        {
          provide: AutoCountFeedbackFlow,
          useValue: {
            shouldAsk: () => shouldAsk,
            record: feedbackRecord,
            disable: feedbackDisable,
          },
        },
      ],
    });
  });

  it('given the dialog is opened, when the camera resolves, then binding and counter start are invoked', async () => {
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();

    expect(cameraOpen).toHaveBeenCalledTimes(1);
    expect(counter.bindSpy).toHaveBeenCalledTimes(1);
    expect(counter.startSpy).toHaveBeenCalledWith({ exerciseId: 'pushup' });
  });

  it('given MAT_DIALOG_DATA preselects "abs.situps", then the pose counter starts with the situp profile', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AutoCountDialogComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: CameraService,
          useValue: { open: cameraOpen, close: cameraClose },
        },
        {
          provide: MatDialogRef,
          useValue: { close: dialogClose },
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { initialExerciseId: 'abs.situps' },
        },
        { provide: REP_COUNTER, useValue: counter },
        { provide: PROXIMITY_REP_COUNTER, useValue: proximity },
        { provide: UserContextService, useValue: userContext },
        {
          provide: AutoCountFeedbackFlow,
          useValue: {
            shouldAsk: () => shouldAsk,
            record: feedbackRecord,
            disable: feedbackDisable,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();

    expect(counter.startSpy).toHaveBeenCalledWith({ exerciseId: 'situp' });
  });

  it('should hand the same camera stream to the proximity counter when the mode is switched', async () => {
    // given
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();
    const component = fixture.componentInstance as unknown as {
      onModeChange: (mode: 'pose' | 'proximity') => Promise<void>;
    };

    // when
    await component.onModeChange('proximity');
    fixture.detectChanges();

    // then — pose detector stopped and reset, proximity bound + started
    expect(counter.stopSpy).toHaveBeenCalledTimes(1);
    expect(counter.reset).toHaveBeenCalledTimes(1);
    expect(proximity.bindSpy).toHaveBeenCalledTimes(1);
    expect(proximity.startSpy).toHaveBeenCalledWith({ exerciseId: 'pushup' });
    expect(cameraOpen).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Handy unter dir');
    expect(fixture.nativeElement.textContent).toContain(
      'Leg das Handy mit dem Display nach oben'
    );
  });

  it('should refuse proximity mode for sit-ups and fall back to the pose detector when switching to them', async () => {
    // given — proximity mode on pushups
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();
    const component = fixture.componentInstance as unknown as {
      onModeChange: (mode: 'pose' | 'proximity') => Promise<void>;
      onExerciseChange: (id: string) => Promise<void>;
      mode: () => 'pose' | 'proximity';
    };
    await component.onModeChange('proximity');
    fixture.detectChanges();
    expect(component.mode()).toBe('proximity');

    // when — the user picks sit-ups
    await component.onExerciseChange('abs.situps');
    fixture.detectChanges();

    // then — back on the pose detector, proximity toggle disabled + explained
    expect(component.mode()).toBe('pose');
    expect(proximity.stopSpy).toHaveBeenCalledTimes(1);
    expect(counter.startSpy).toHaveBeenLastCalledWith({ exerciseId: 'situp' });
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="auto-count-proximity-unavailable"]'
      )
    ).toBeTruthy();
    const proximityToggle = fixture.nativeElement.querySelector(
      '[data-testid="auto-count-mode-proximity"] button'
    ) as HTMLButtonElement;
    expect(proximityToggle.disabled).toBe(true);

    // when — proximity is requested anyway
    await component.onModeChange('proximity');

    // then
    expect(component.mode()).toBe('pose');
    expect(proximity.startSpy).toHaveBeenCalledTimes(1);
  });

  it('should open a proximity-only exercise straight on the proximity detector and hide the pose option', async () => {
    // given — burpees have no pose profile but are proximity-countable
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AutoCountDialogComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: CameraService,
          useValue: { open: cameraOpen, close: cameraClose },
        },
        { provide: MatDialogRef, useValue: { close: dialogClose } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { initialExerciseId: 'cardio.burpees' },
        },
        { provide: REP_COUNTER, useValue: counter },
        { provide: PROXIMITY_REP_COUNTER, useValue: proximity },
        { provide: UserContextService, useValue: userContext },
        {
          provide: AutoCountFeedbackFlow,
          useValue: {
            shouldAsk: () => shouldAsk,
            record: feedbackRecord,
            disable: feedbackDisable,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();
    fixture.detectChanges();

    // then
    expect(proximity.startSpy).toHaveBeenCalledWith({
      exerciseId: 'cardio.burpees',
    });
    expect(counter.startSpy).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="auto-count-pose-unavailable"]'
      )
    ).toBeTruthy();
    const poseToggle = fixture.nativeElement.querySelector(
      '[data-testid="auto-count-mode-pose"] button'
    ) as HTMLButtonElement;
    expect(poseToggle.disabled).toBe(true);

    // when
    (fixture.componentInstance as unknown as { save: () => void }).save();

    // then — a catalog id, not a profile id, leaves the dialog
    expect(dialogClose).toHaveBeenCalledWith(null);
  });

  it('should show the near/far position instead of the joint angle in proximity mode', async () => {
    // given
    const state = signal<RepCountSnapshot>({
      count: 2,
      phase: 'down',
      lastRepAtMs: 10,
    });
    proximity = makeCounter(state);
    proximity.frame.set({
      angleDeg: 45,
      confidence: 1,
      timestampMs: 1,
      pose: null,
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AutoCountDialogComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: CameraService,
          useValue: { open: cameraOpen, close: cameraClose },
        },
        { provide: MatDialogRef, useValue: { close: dialogClose } },
        { provide: MAT_DIALOG_DATA, useValue: { initialMode: 'proximity' } },
        { provide: REP_COUNTER, useValue: counter },
        { provide: PROXIMITY_REP_COUNTER, useValue: proximity },
        { provide: UserContextService, useValue: userContext },
        {
          provide: AutoCountFeedbackFlow,
          useValue: {
            shouldAsk: () => shouldAsk,
            record: feedbackRecord,
            disable: feedbackDisable,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();
    fixture.detectChanges();

    // then
    expect(proximity.startSpy).toHaveBeenCalledTimes(1);
    expect(counter.startSpy).not.toHaveBeenCalled();
    const near = fixture.nativeElement.querySelector(
      '[data-testid="auto-count-proximity"]'
    ) as HTMLElement;
    expect(near.textContent).toContain('75%');
    expect(fixture.nativeElement.textContent).toContain('Nähe');
    expect(fixture.nativeElement.textContent).not.toContain('Winkel');

    // when — save now opens the accuracy question first
    (fixture.componentInstance as unknown as { save: () => void }).save();
    fixture.detectChanges();
    (
      fixture.componentInstance as unknown as {
        onConfirmed: (reps: number) => void;
      }
    ).onConfirmed(2);

    // then
    expect(dialogClose).toHaveBeenCalledWith({ exerciseId: 'pushup', reps: 2 });
  });

  it('given the dialog is destroyed, when teardown runs, then counter.stop and camera.close are each called once', async () => {
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();

    fixture.destroy();
    await flushAsync();

    expect(counter.stopSpy).toHaveBeenCalledTimes(1);
    expect(cameraClose).toHaveBeenCalledTimes(1);
  });

  it('given the camera throws on open, when the dialog is rendered, then the error signal is populated and counter.start is not called', async () => {
    cameraOpen.mockRejectedValueOnce(new Error('NotAllowedError'));

    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();

    expect(counter.startSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent.includes('NotAllowedError')).toBe(
      true
    );
  });

  it('given an emitted form-check frame, when the panel is open, then angle and confidence render', async () => {
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();

    counter.frame.set({
      angleDeg: 142.3,
      confidence: 0.87,
      timestampMs: 100,
      pose: null,
    });
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('142°');
    expect(text).toContain('87%');
  });

  it('given the Form-Check is toggled off, when the panel is hidden, then no angle row is rendered', async () => {
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();

    counter.frame.set({
      angleDeg: 99,
      confidence: 0.5,
      timestampMs: 0,
      pose: null,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('99°');

    const toggle = fixture.nativeElement.querySelector(
      '.form-check-toggle'
    ) as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('99°');
  });
  it('given a non-admin, when the dialog opens, then the tuning panel stays hidden', async () => {
    // given / when
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();

    // then
    expect(
      fixture.nativeElement.querySelector('[data-testid="auto-count-tuning"]')
    ).toBeNull();
  });

  it('given an admin in pose mode, when the dialog opens, then the debug toggle is offered but the panel stays closed', async () => {
    // given
    userContext = makeUserContext(true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AutoCountDialogComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: CameraService,
          useValue: { open: cameraOpen, close: cameraClose },
        },
        { provide: MatDialogRef, useValue: { close: dialogClose } },
        { provide: REP_COUNTER, useValue: counter },
        { provide: PROXIMITY_REP_COUNTER, useValue: proximity },
        { provide: UserContextService, useValue: userContext },
        {
          provide: AutoCountFeedbackFlow,
          useValue: {
            shouldAsk: () => shouldAsk,
            record: feedbackRecord,
            disable: feedbackDisable,
          },
        },
      ],
    });

    // when
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();

    // then — the sliders cover the preview, so they are opt-in
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="auto-count-tuning-toggle"]'
      )
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="auto-count-tuning"]')
    ).toBeNull();

    // when
    (
      fixture.nativeElement.querySelector(
        '[data-testid="auto-count-tuning-toggle"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    // then
    expect(
      fixture.nativeElement.querySelector('[data-testid="auto-count-tuning"]')
    ).not.toBeNull();
  });

  it('given a non-admin, when the dialog opens, then there is no debug toggle at all', async () => {
    // given / when
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();

    // then
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="auto-count-tuning-toggle"]'
      )
    ).toBeNull();
  });

  it('given a counted set, when save is pressed, then the accuracy question is shown instead of closing', async () => {
    // given
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();
    state.set({ count: 5, phase: 'up', lastRepAtMs: 10 });
    fixture.detectChanges();

    // when
    (fixture.componentInstance as unknown as { save: () => void }).save();
    fixture.detectChanges();

    // then
    expect(dialogClose).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-testid="auto-count-confirm"]')
    ).not.toBeNull();
  });

  it('given the user corrects the count, when confirmed, then the entry is booked with the corrected number', async () => {
    // given
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();
    state.set({ count: 5, phase: 'up', lastRepAtMs: 10 });
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { save: () => void }).save();
    fixture.detectChanges();

    // when
    (
      fixture.componentInstance as unknown as {
        onConfirmed: (reps: number) => void;
      }
    ).onConfirmed(7);

    // then
    expect(dialogClose).toHaveBeenCalledWith({ exerciseId: 'pushup', reps: 7 });
    expect(feedbackRecord).toHaveBeenCalledWith(
      expect.objectContaining({ detectedReps: 5, mode: 'pose' }),
      7
    );
  });

  it('given the user opts out, when dismissed, then the question is disabled and the detected count is booked', async () => {
    // given
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();
    state.set({ count: 5, phase: 'up', lastRepAtMs: 10 });
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { save: () => void }).save();

    // when
    (
      fixture.componentInstance as unknown as {
        onFeedbackDismissed: () => void;
      }
    ).onFeedbackDismissed();

    // then
    expect(feedbackDisable).toHaveBeenCalledTimes(1);
    expect(dialogClose).toHaveBeenCalledWith({ exerciseId: 'pushup', reps: 5 });
  });

  it('given the question is switched off, when save is pressed, then the dialog closes straight away', async () => {
    // given
    shouldAsk = false;
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();
    state.set({ count: 5, phase: 'up', lastRepAtMs: 10 });
    fixture.detectChanges();

    // when
    (fixture.componentInstance as unknown as { save: () => void }).save();

    // then
    expect(dialogClose).toHaveBeenCalledWith({ exerciseId: 'pushup', reps: 5 });
    expect(feedbackRecord).not.toHaveBeenCalled();
  });
  it('given a stray rep after save, when confirmed, then the frozen count is booked and reported', async () => {
    // given — the user finishes 5 and presses save
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();
    state.set({ count: 5, phase: 'up', lastRepAtMs: 10 });
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { save: () => void }).save();
    fixture.detectChanges();

    // when — the camera catches one more movement while they reach for the phone
    state.set({ count: 6, phase: 'up', lastRepAtMs: 20 });
    fixture.detectChanges();
    (
      fixture.componentInstance as unknown as {
        onConfirmed: (reps: number) => void;
      }
    ).onConfirmed(5);

    // then — the question was about 5, so 5 is what gets booked and filed
    expect(dialogClose).toHaveBeenCalledWith({ exerciseId: 'pushup', reps: 5 });
    expect(feedbackRecord).toHaveBeenCalledWith(
      expect.objectContaining({ detectedReps: 5 }),
      5
    );
  });

  it('given the accuracy question opens, when it is shown, then the detector is stopped', async () => {
    // given
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();
    state.set({ count: 5, phase: 'up', lastRepAtMs: 10 });
    fixture.detectChanges();
    counter.stopSpy.mockClear();

    // when
    (fixture.componentInstance as unknown as { save: () => void }).save();

    // then
    expect(counter.stopSpy).toHaveBeenCalled();
  });

  it('given the question is open, when it renders, then it shows the count as it was at save time', async () => {
    // given
    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();
    state.set({ count: 5, phase: 'up', lastRepAtMs: 10 });
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { save: () => void }).save();
    fixture.detectChanges();

    // when — a late frame bumps the live counter
    state.set({ count: 9, phase: 'up', lastRepAtMs: 30 });
    fixture.detectChanges();

    // then
    const confirm = fixture.nativeElement.querySelector(
      '[data-testid="auto-count-confirm"]'
    ) as HTMLElement;
    expect(confirm.textContent).toContain('5');
    expect(confirm.textContent).not.toContain('9');
  });
});
