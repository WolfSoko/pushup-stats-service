import { PLATFORM_ID, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import {
  type HoldFormCheckFrame,
  type HoldSnapshot,
  PoseHoldTimerService,
} from '@pu-stats/auto-count';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CameraService } from './camera.service';
import { ExerciseTimerDialogComponent } from './exercise-timer-dialog.component';

const INITIAL_SNAPSHOT: HoldSnapshot = {
  totalMs: 0,
  phase: 'idle',
  segmentStartMs: null,
};

const flushAsync = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

const makeTimer = (
  state: WritableSignal<HoldSnapshot> = signal<HoldSnapshot>(INITIAL_SNAPSHOT),
  frame: WritableSignal<HoldFormCheckFrame | null> = signal<HoldFormCheckFrame | null>(
    null
  )
): Pick<
  PoseHoldTimerService,
  | 'snapshot'
  | 'isActive'
  | 'formCheckFrame'
  | 'bindVideoElement'
  | 'start'
  | 'stop'
  | 'reset'
> & {
  startSpy: ReturnType<typeof vi.fn>;
  stopSpy: ReturnType<typeof vi.fn>;
  resetSpy: ReturnType<typeof vi.fn>;
  bindSpy: ReturnType<typeof vi.fn>;
  state: WritableSignal<HoldSnapshot>;
} => {
  const isActive = signal(false);
  const start = vi.fn(async () => {
    isActive.set(true);
  });
  const stop = vi.fn(async () => {
    isActive.set(false);
    frame.set(null);
  });
  const bind = vi.fn();
  const reset = vi.fn(() => {
    state.set(INITIAL_SNAPSHOT);
    frame.set(null);
  });
  return {
    snapshot: state.asReadonly(),
    isActive: isActive.asReadonly(),
    formCheckFrame: frame.asReadonly(),
    bindVideoElement: bind,
    start,
    stop,
    reset,
    startSpy: start,
    stopSpy: stop,
    resetSpy: reset,
    bindSpy: bind,
    state,
  };
};

describe('ExerciseTimerDialogComponent', () => {
  let timer: ReturnType<typeof makeTimer>;
  let cameraOpen: ReturnType<typeof vi.fn>;
  let cameraClose: ReturnType<typeof vi.fn>;
  let dialogClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    timer = makeTimer();
    cameraOpen = vi.fn().mockResolvedValue(undefined);
    cameraClose = vi.fn().mockResolvedValue(undefined);
    dialogClose = vi.fn();

    TestBed.configureTestingModule({
      imports: [ExerciseTimerDialogComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: CameraService,
          useValue: { open: cameraOpen, close: cameraClose },
        },
        { provide: MatDialogRef, useValue: { close: dialogClose } },
      ],
    }).overrideComponent(ExerciseTimerDialogComponent, {
      set: {
        providers: [{ provide: PoseHoldTimerService, useValue: timer }],
      },
    });
  });

  it('given the dialog opens in default (manual) mode, when nothing else happens, then the camera is not started', async () => {
    const fixture = TestBed.createComponent(ExerciseTimerDialogComponent);
    fixture.detectChanges();
    await flushAsync();

    expect(cameraOpen).not.toHaveBeenCalled();
    expect(timer.startSpy).not.toHaveBeenCalled();
  });

  it('given camera mode is toggled on, when settled, then the camera opens and the timer starts with the active exercise', async () => {
    const fixture = TestBed.createComponent(ExerciseTimerDialogComponent);
    fixture.detectChanges();
    await flushAsync();

    await fixture.componentInstance['onModeToggle'](true);
    await flushAsync();

    expect(cameraOpen).toHaveBeenCalledTimes(1);
    expect(timer.bindSpy).toHaveBeenCalledTimes(1);
    expect(timer.startSpy).toHaveBeenCalledWith({ exerciseId: 'plank' });
  });

  it('given camera mode and a hold of 7 seconds, when save is invoked, then the dialog closes with durationSec=7', async () => {
    const fixture = TestBed.createComponent(ExerciseTimerDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await fixture.componentInstance['onModeToggle'](true);
    await flushAsync();

    timer.state.set({
      totalMs: 7100,
      phase: 'paused',
      segmentStartMs: null,
    });
    fixture.detectChanges();

    fixture.componentInstance['save']();
    expect(dialogClose).toHaveBeenCalledWith({
      exerciseId: 'plank',
      durationSec: 7,
    });
  });

  it('given totalSec is 0, when save is invoked, then the dialog closes with null (no entry created)', () => {
    const fixture = TestBed.createComponent(ExerciseTimerDialogComponent);
    fixture.detectChanges();

    fixture.componentInstance['save']();
    expect(dialogClose).toHaveBeenCalledWith(null);
  });

  it('given the exercise is switched in camera mode, when settled, then the timer is stopped/reset and restarted with the new id', async () => {
    const fixture = TestBed.createComponent(ExerciseTimerDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await fixture.componentInstance['onModeToggle'](true);
    await flushAsync();

    timer.startSpy.mockClear();
    timer.stopSpy.mockClear();
    timer.resetSpy.mockClear();

    await fixture.componentInstance['onExerciseChange']('hollowhold');
    await flushAsync();

    expect(timer.stopSpy).toHaveBeenCalledTimes(1);
    expect(timer.resetSpy).toHaveBeenCalledTimes(1);
    expect(timer.startSpy).toHaveBeenCalledWith({ exerciseId: 'hollowhold' });
  });

  it('given the dialog is destroyed, when teardown runs, then timer.stop and camera.close are each called once', async () => {
    const fixture = TestBed.createComponent(ExerciseTimerDialogComponent);
    fixture.detectChanges();
    await flushAsync();

    fixture.destroy();
    await flushAsync();

    expect(timer.stopSpy).toHaveBeenCalledTimes(1);
    expect(cameraClose).toHaveBeenCalledTimes(1);
  });

  it('given camera mode is toggled off again, when settled, then the camera stream is closed (not left running)', async () => {
    const fixture = TestBed.createComponent(ExerciseTimerDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await fixture.componentInstance['onModeToggle'](true);
    await flushAsync();

    cameraClose.mockClear();
    timer.stopSpy.mockClear();

    await fixture.componentInstance['onModeToggle'](false);
    await flushAsync();

    expect(timer.stopSpy).toHaveBeenCalledTimes(1);
    expect(cameraClose).toHaveBeenCalledTimes(1);
  });

  it('given camera.open succeeds but timer.start throws, when settled, then both timer.stop and camera.close are invoked to release resources', async () => {
    timer.startSpy.mockRejectedValueOnce(new Error('detector init failed'));
    const fixture = TestBed.createComponent(ExerciseTimerDialogComponent);
    fixture.detectChanges();
    await flushAsync();

    await fixture.componentInstance['onModeToggle'](true);
    await flushAsync();

    expect(cameraOpen).toHaveBeenCalledTimes(1);
    expect(timer.stopSpy).toHaveBeenCalledTimes(1);
    expect(cameraClose).toHaveBeenCalledTimes(1);
  });

  it('given the manual stopwatch is toggled twice across a tick, when stopped, then manualMs is not double-counted', async () => {
    vi.useFakeTimers({ now: 1_000 });
    try {
      const fixture = TestBed.createComponent(ExerciseTimerDialogComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance as unknown as {
        toggleManual: () => void;
        totalSec: () => number;
      };

      component.toggleManual(); // start at performance.now() = 1000
      vi.advanceTimersByTime(5_000); // tick → manualMs = 5000
      component.toggleManual(); // stop at performance.now() = 6000

      expect(component.totalSec()).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });
});
