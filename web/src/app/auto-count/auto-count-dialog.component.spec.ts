import { PLATFORM_ID, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  type FormCheckFrame,
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
  let cameraOpen: ReturnType<typeof vi.fn>;
  let cameraClose: ReturnType<typeof vi.fn>;
  let dialogClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    counter = makeCounter();
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

  it('given MAT_DIALOG_DATA preselects "situp", then the counter starts with situp instead of pushup', async () => {
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
          useValue: { initialExerciseId: 'situp' },
        },
        { provide: REP_COUNTER, useValue: counter },
      ],
    });

    const fixture = TestBed.createComponent(AutoCountDialogComponent);
    fixture.detectChanges();
    await flushAsync();
    await flushAsync();

    expect(counter.startSpy).toHaveBeenCalledWith({ exerciseId: 'situp' });
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
