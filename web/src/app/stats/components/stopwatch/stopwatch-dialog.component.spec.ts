import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { StopwatchSignalService } from './stopwatch-signal.service';
import {
  StopwatchDialogComponent,
  StopwatchDialogData,
} from './stopwatch-dialog.component';

describe('StopwatchDialogComponent', () => {
  let fixture: ComponentFixture<StopwatchDialogComponent>;
  const close = vi.fn();

  function byTestId(id: string): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  }

  async function setup(data: StopwatchDialogData): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [StopwatchDialogComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: StopwatchSignalService, useValue: { play: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(StopwatchDialogComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000 });
    close.mockClear();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('should name the exercise and render the prescribed target', async () => {
    // given
    await setup({ exerciseId: 'core.mountainclimbers.time', targetSec: 30 });

    // then
    expect(byTestId('stopwatch-dialog-exercise').textContent).toContain(
      'Mountain Climbers (Zeit)'
    );
    expect(byTestId('stopwatch-target').textContent).toContain('00:30');
    expect(
      (byTestId('stopwatch-dialog-save') as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('should close with the stopped seconds for the given exercise', async () => {
    // given
    await setup({ exerciseId: 'squat.wallsit', targetSec: 45 });
    byTestId('stopwatch-toggle').click();
    vi.advanceTimersByTime(12_000);
    byTestId('stopwatch-toggle').click();
    fixture.detectChanges();

    // when
    byTestId('stopwatch-dialog-save').click();

    // then
    expect(close).toHaveBeenCalledWith({
      exerciseId: 'squat.wallsit',
      durationSec: 12,
    });
  });

  it('should run as a free-standing stopwatch without an exercise', async () => {
    // given
    await setup({});
    byTestId('stopwatch-toggle').click();
    vi.advanceTimersByTime(7_000);
    byTestId('stopwatch-toggle').click();
    fixture.detectChanges();

    // then
    expect(byTestId('stopwatch-dialog-exercise').textContent).toContain(
      'Stoppuhr'
    );
    expect(byTestId('stopwatch-target')).toBeNull();

    // when
    byTestId('stopwatch-dialog-save').click();

    // then — no exercise echoed back
    expect(close).toHaveBeenCalledWith({ durationSec: 7 });
  });

  it('should close with null on cancel and hide the target line without one', async () => {
    // given
    await setup({ exerciseId: 'cardio.highknees' });

    // when
    byTestId('stopwatch-dialog-cancel').click();

    // then
    expect(close).toHaveBeenCalledWith(null);
    expect(byTestId('stopwatch-target')).toBeNull();
  });
});
