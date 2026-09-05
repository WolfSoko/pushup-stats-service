import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { UserContextService } from '@pu-auth/auth';
import { UserAchievementsApiService } from '@pu-stats/data-access';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { STORAGE_KEY } from './achievement-celebration';
import { AchievementCelebrationService } from './achievement-celebration.service';

function setup(options: {
  earned?: Array<{ id: string; awardedAt: string }>;
  stream?: Subject<Array<{ id: string; awardedAt: string }>>;
  userId?: string | null;
  platform?: string;
}) {
  const open = vi.fn();
  const watchEarned = vi.fn(() => options.stream ?? of(options.earned ?? []));
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
      { provide: MatDialog, useValue: { open } },
      { provide: UserAchievementsApiService, useValue: { watchEarned } },
      {
        provide: UserContextService,
        useValue: {
          // `??` would swallow an explicit `null` here — the "signed out"
          // case has to survive the default.
          userIdSafe: () => ('userId' in options ? options.userId : 'uid-1'),
        },
      },
    ],
  });
  const service = TestBed.inject(AchievementCelebrationService);
  return { service, open, watchEarned };
}

describe('AchievementCelebrationService', () => {
  beforeEach(() => {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
    TestBed.resetTestingModule();
  });

  it('should open a dialog for a newly earned badge', () => {
    // when
    const { open } = setup({
      earned: [{ id: 'plan-days-1', awardedAt: '2026-01-02T00:00:00.000Z' }],
    });

    // then
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('should not reopen for a badge already celebrated', () => {
    // given — the document re-syncs on every visit
    globalThis.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify(['plan-days-1'])
    );

    // when
    const { open } = setup({
      earned: [{ id: 'plan-days-1', awardedAt: '2026-01-02T00:00:00.000Z' }],
    });

    // then
    expect(open).not.toHaveBeenCalled();
  });

  it('should show only one dialog when two badges arrive together', () => {
    // given — a plan's last day can complete a milestone and the plan in
    // the same write; stacking two modals would be hostile
    // when
    const { open } = setup({
      earned: [
        { id: 'plan-days-10', awardedAt: '2026-03-01T00:00:00.000Z' },
        {
          id: 'plan-completed-core-4w-v1',
          awardedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
    });

    // then
    expect(open).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '[]')
    ).toEqual(['plan-completed-core-4w-v1', 'plan-days-10']);
  });

  it('should stay silent for an id the catalog no longer knows', () => {
    // when
    const { open } = setup({
      earned: [{ id: 'plan-days-7', awardedAt: '2026-01-02T00:00:00.000Z' }],
    });

    // then
    expect(open).not.toHaveBeenCalled();
  });

  it('should not subscribe on the server', () => {
    // given — the dialog is browser-only, and an SSR subscription would
    // hold the render open
    // when
    const { open, watchEarned } = setup({ platform: 'server' });

    // then
    expect(watchEarned).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('should not subscribe without a signed-in user', () => {
    // when
    const { watchEarned } = setup({ userId: null });

    // then
    expect(watchEarned).not.toHaveBeenCalled();
  });

  it('should react to a badge arriving later in the session', () => {
    // given — awarding is asynchronous, so the document can sync minutes
    // after the plan day was ticked off
    const stream = new Subject<Array<{ id: string; awardedAt: string }>>();
    const { open } = setup({ stream });
    expect(open).not.toHaveBeenCalled();

    // when
    stream.next([{ id: 'plan-days-1', awardedAt: '2026-01-02T00:00:00.000Z' }]);

    // then
    expect(open).toHaveBeenCalledTimes(1);
  });
});
