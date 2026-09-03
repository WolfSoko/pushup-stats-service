import { PLATFORM_ID, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  type FormCheckFrame,
  PROXIMITY_REP_COUNTER,
  REP_COUNTER,
  type RepCountSnapshot,
} from '@pu-stats/auto-count';
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

describe('AutoCountDialogComponent', () => {
  let counter: ReturnType<typeof makeCounter>;
  let proximity: ReturnType<typeof makeCounter>;
  let cameraOpen: ReturnType<typeof vi.fn>;
  let cameraClose: ReturnType<typeof vi.fn>;
  let dialogClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    counter = makeCounter();
    proximity = makeCounter();
    cameraOpen = vi.fn().mockResolvedValue(undefined);
    cameraClose = vi.fn().mockResolvedValue(undefined);
    dialogClose = vi.fn();

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
    proximity.frame.set({ angleDeg: 45, confidence: 1, timestampMs: 1 });
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

    // when
    (fixture.componentInstance as unknown as { save: () => void }).save();

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

    counter.frame.set({ angleDeg: 142.3, confidence: 0.87, timestampMs: 100 });
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

    counter.frame.set({ angleDeg: 99, confidence: 0.5, timestampMs: 0 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('99°');

    const toggle = fixture.nativeElement.querySelector(
      '.form-check-toggle'
    ) as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('99°');
  });
});
