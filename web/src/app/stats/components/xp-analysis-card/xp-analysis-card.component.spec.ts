import { signal } from '@angular/core';
import { UserContextService } from '@pu-auth/auth';
import { XpApiService } from '@pu-stats/data-access';
import { LiveDataStore, XpStore } from '@pu-stats/data-access-state';
import {
  levelProgress,
  type StatsGranularity,
  type XpEntryInput,
} from '@pu-stats/models';
import { render, screen } from '@testing-library/angular';
import { of } from 'rxjs';

import { AnalysisStore } from '../../analysis.store';
import type { XpAnalysisEntry } from '../../analysis/xp-analysis';
import { XpAnalysisCardComponent } from './xp-analysis-card.component';

function row(
  id: string,
  exerciseId: string,
  timestamp: string,
  reps: number
): XpAnalysisEntry {
  return { _id: id, exerciseId, timestamp, reps };
}

async function setup(opts: {
  rows: XpAnalysisEntry[];
  booked?: ReadonlyMap<string, number>;
  loaded?: boolean;
  granularity?: StatsGranularity;
}) {
  const watchLedger = vi.fn(() => of(opts.booked ?? new Map()));
  await render(XpAnalysisCardComponent, {
    providers: [
      {
        provide: AnalysisStore,
        useValue: {
          from: signal('2026-09-01'),
          to: signal('2026-09-07'),
          visibleRows: signal(opts.rows),
          viewGranularity: signal(opts.granularity ?? 'daily'),
        },
      },
      {
        provide: LiveDataStore,
        useValue: { exerciseEntriesLoaded: signal(true) },
      },
      {
        provide: XpStore,
        useValue: {
          loaded: signal(opts.loaded ?? true),
          progress: signal(levelProgress(450)),
          previewXp: (e: XpEntryInput) => (e.reps ?? 0) * 2,
        },
      },
      { provide: XpApiService, useValue: { watchLedger } },
      { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
    ],
  });
  return { watchLedger };
}

describe('XpAnalysisCardComponent', () => {
  it('should total the visible rows at today’s rate when nothing is booked yet', async () => {
    // given
    await setup({
      rows: [
        row('a', 'pushup', '2026-09-02T08:00:00', 10),
        row('b', 'pull.pullups', '2026-09-03T08:00:00', 5),
      ],
    });

    // then
    expect(screen.getByTestId('analysis-xp-total').textContent?.trim()).toBe(
      '30'
    );
    expect(screen.getByText('Level 3')).toBeTruthy();
    expect(screen.getByTestId('analysis-xp-bars').children).toHaveLength(7);
  });

  it('should prefer the booked ledger XP over a recomputation', async () => {
    // given
    await setup({
      rows: [row('a', 'pushup', '2026-09-02T08:00:00', 10)],
      booked: new Map([['a', 7]]),
    });

    // then
    expect(screen.getByTestId('analysis-xp-total').textContent?.trim()).toBe(
      '7'
    );
  });

  it('should listen to the ledger only from the start of the range', async () => {
    // given / when
    const { watchLedger } = await setup({ rows: [] });

    // then
    expect(watchLedger).toHaveBeenCalledWith('u1', '2026-09-01');
  });

  it('should follow the page granularity for the bars', async () => {
    // given
    await setup({
      rows: [row('a', 'pushup', '2026-09-02T08:00:00', 10)],
      granularity: 'weekly',
    });

    // then
    expect(screen.getByText('XP pro Woche')).toBeTruthy();
  });

  it('should explain an empty range instead of drawing empty bars', async () => {
    // given
    await setup({ rows: [] });

    // then
    expect(screen.getByText(/noch keine XP gesammelt/)).toBeTruthy();
    expect(screen.queryByTestId('analysis-xp-bars')).toBeNull();
  });

  it('should show a skeleton while XP is loading', async () => {
    // given
    await setup({ rows: [], loaded: false });

    // then
    expect(screen.queryByTestId('analysis-xp-total')).toBeNull();
  });
});
