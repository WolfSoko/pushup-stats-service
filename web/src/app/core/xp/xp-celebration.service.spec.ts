import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DEMO_USER_ID, ExerciseFirestoreService } from '@pu-stats/data-access';
import { XpStore } from '@pu-stats/data-access-state';
import type { ExerciseEntry, XpEntryInput } from '@pu-stats/models';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { CelebrationQueueService } from '../celebration-queue.service';
import { XP_COALESCE_MS, XpCelebrationService } from './xp-celebration.service';

function entry(over: Partial<ExerciseEntry> = {}): ExerciseEntry {
  return {
    _id: 'e1',
    userId: 'u1',
    exerciseId: 'pushup',
    timestamp: '2026-09-24T10:00:00',
    reps: 20,
    source: 'web',
    ...over,
  };
}

function setup(options: { loaded?: boolean; total?: number } = {}) {
  const created = new Subject<ExerciseEntry>();
  const open = vi.fn();
  const enqueue = vi.fn(async (fn: () => unknown) => {
    open(await fn());
  });
  const dialogOpen = vi.fn((_c: unknown, config: { data: unknown }) => ({
    data: config.data,
  }));
  const snackOpen = vi.fn();
  const total = { value: options.total ?? 90 };
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: MatDialog, useValue: { open: dialogOpen } },
      { provide: MatSnackBar, useValue: { open: snackOpen } },
      { provide: CelebrationQueueService, useValue: { enqueue } },
      { provide: DEMO_USER_ID, useValue: 'demo' },
      {
        provide: ExerciseFirestoreService,
        useValue: { entryCreated$: created },
      },
      {
        provide: XpStore,
        useValue: {
          loaded: () => options.loaded ?? true,
          previewXp: (e: XpEntryInput) => e.reps ?? 0,
          totalXp: () => total.value,
        },
      },
    ],
  });
  const service = TestBed.inject(XpCelebrationService);
  return { service, created, dialogOpen, snackOpen, total, enqueue };
}

function shownData(dialogOpen: ReturnType<typeof vi.fn>) {
  return (dialogOpen.mock.calls.at(-1)?.[1] as { data: Record<string, any> })
    ?.data;
}

describe('XpCelebrationService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('should celebrate a saved entry from any save path', async () => {
    // given
    const { created, dialogOpen } = setup();

    // when
    created.next(entry());
    await vi.advanceTimersByTimeAsync(XP_COALESCE_MS);

    // then
    expect(shownData(dialogOpen)).toEqual(
      expect.objectContaining({
        xp: 20,
        before: expect.objectContaining({ level: 1, totalXp: 90 }),
        after: expect.objectContaining({ level: 2, totalXp: 110 }),
      })
    );
  });

  it('should coalesce saves close together into one dialog', async () => {
    // given
    const { created, dialogOpen, enqueue } = setup();

    // when
    created.next(entry({ _id: 'a', reps: 10 }));
    await vi.advanceTimersByTimeAsync(XP_COALESCE_MS / 2);
    created.next(entry({ _id: 'b', reps: 5 }));
    await vi.advanceTimersByTimeAsync(XP_COALESCE_MS);

    // then
    expect(enqueue).toHaveBeenCalledOnce();
    expect(dialogOpen).toHaveBeenCalledOnce();
    expect(shownData(dialogOpen)?.['xp']).toBe(15);
  });

  it('should start the level bar from the total seen when the save arrived', async () => {
    // given
    const { created, dialogOpen, total } = setup({ total: 90 });

    // when — the server books the entry before the dialog shows
    created.next(entry());
    total.value = 110;
    await vi.advanceTimersByTimeAsync(XP_COALESCE_MS);

    // then
    expect(shownData(dialogOpen)?.['before'].totalXp).toBe(90);
  });

  it('should fall back to the saved snackbar when the entry is worth nothing', async () => {
    // given
    const { created, dialogOpen, snackOpen } = setup();

    // when
    created.next(entry({ reps: 0 }));
    await vi.advanceTimersByTimeAsync(XP_COALESCE_MS);

    // then
    expect(dialogOpen).not.toHaveBeenCalled();
    expect(snackOpen).toHaveBeenCalledWith(
      'Eintrag gespeichert.',
      '',
      expect.anything()
    );
  });

  it('should only confirm with a snackbar for the demo account', async () => {
    // given
    const { created, dialogOpen, snackOpen } = setup();

    // when
    created.next(entry({ userId: 'demo' }));
    await vi.advanceTimersByTimeAsync(XP_COALESCE_MS);

    // then
    expect(dialogOpen).not.toHaveBeenCalled();
    expect(snackOpen).toHaveBeenCalledOnce();
  });

  it('should hold a session source until released and leave others alone', async () => {
    // given
    const { service, created, dialogOpen } = setup();
    const hold = service.hold(['plan-session']);

    // when
    created.next(entry({ _id: 's1', source: 'plan-session', reps: 10 }));
    created.next(entry({ _id: 's2', source: 'plan-session', reps: 12 }));
    created.next(entry({ _id: 'q1', source: 'quick-add', reps: 3 }));
    await vi.advanceTimersByTimeAsync(XP_COALESCE_MS);

    // then
    expect(dialogOpen).toHaveBeenCalledOnce();
    expect(shownData(dialogOpen)?.['xp']).toBe(3);

    // when
    hold.release();
    hold.release();
    await vi.advanceTimersByTimeAsync(0);

    // then
    expect(dialogOpen).toHaveBeenCalledTimes(2);
    expect(shownData(dialogOpen)?.['xp']).toBe(22);
  });

  it('should not count a session twice when the total was unknown at its start', async () => {
    // given — XP had not loaded when the session started
    const { service, created, dialogOpen, total } = setup({
      loaded: false,
      total: 100,
    });
    const hold = service.hold(['plan-session']);
    created.next(entry({ source: 'plan-session', reps: 30 }));

    // when — by the done screen the server has booked it
    total.value = 130;
    hold.release();
    await vi.advanceTimersByTimeAsync(0);

    // then
    expect(shownData(dialogOpen)?.['before'].totalXp).toBe(100);
  });
});
