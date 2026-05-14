import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import {
  PoseRepCounterService,
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
  state = signal<RepCountSnapshot>(INITIAL_SNAPSHOT)
): Pick<
  PoseRepCounterService,
  'snapshot' | 'isActive' | 'bindVideoElement' | 'start' | 'stop' | 'reset'
> & {
  startSpy: ReturnType<typeof vi.fn>;
  stopSpy: ReturnType<typeof vi.fn>;
  bindSpy: ReturnType<typeof vi.fn>;
} => {
  const isActive = signal(false);
  const start = vi.fn(async () => {
    isActive.set(true);
  });
  const stop = vi.fn(async () => {
    isActive.set(false);
  });
  const bind = vi.fn();
  return {
    snapshot: state.asReadonly(),
    isActive: isActive.asReadonly(),
    bindVideoElement: bind,
    start,
    stop,
    reset: vi.fn(),
    startSpy: start,
    stopSpy: stop,
    bindSpy: bind,
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
      ],
    }).overrideComponent(AutoCountDialogComponent, {
      set: {
        providers: [{ provide: PoseRepCounterService, useValue: counter }],
      },
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
});
