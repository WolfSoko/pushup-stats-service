import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LiveDataStore, XpStore } from '@pu-stats/data-access-state';
import { levelProgress, type ExerciseEntry } from '@pu-stats/models';
import { render, screen } from '@testing-library/angular';

import { AnalysisStore } from '../../analysis.store';
import { XpAnalysisCardComponent } from './xp-analysis-card.component';

function entry(
  id: string,
  exerciseId: string,
  timestamp: string,
  reps: number
): ExerciseEntry {
  return { _id: id, userId: 'u1', exerciseId, timestamp, reps, source: 'web' };
}

async function setup(opts: {
  entries: ExerciseEntry[];
  loaded?: boolean;
  hidden?: string[];
}) {
  const entries = signal(opts.entries);
  await render(XpAnalysisCardComponent, {
    providers: [
      {
        provide: AnalysisStore,
        useValue: {
          from: signal('2026-09-01'),
          to: signal('2026-09-07'),
          hiddenExerciseIds: signal(opts.hidden ?? []),
        },
      },
      {
        provide: LiveDataStore,
        useValue: {
          exerciseEntries: entries,
          exerciseEntriesLoaded: signal(true),
        },
      },
      {
        provide: XpStore,
        useValue: {
          loaded: signal(opts.loaded ?? true),
          progress: signal(levelProgress(450)),
          xpOfEntry: (_id: string, e: ExerciseEntry) => (e.reps ?? 0) * 2,
        },
      },
    ],
  });
  return { entries };
}

describe('XpAnalysisCardComponent', () => {
  it('should total the XP of the range entries with their booked value', async () => {
    // given
    await setup({
      entries: [
        entry('a', 'pushup', '2026-09-02T08:00:00', 10),
        entry('b', 'pull.pullups', '2026-09-03T08:00:00', 5),
        entry('c', 'pushup', '2026-08-01T08:00:00', 100),
      ],
    });

    // then — the August entry lies outside the range
    expect(screen.getByTestId('analysis-xp-total').textContent?.trim()).toBe(
      '30'
    );
    expect(screen.getByText('Level 3')).toBeTruthy();
    expect(screen.getByTestId('analysis-xp-bars').children).toHaveLength(7);
  });

  it('should leave hidden exercises out, like the rest of the page', async () => {
    // given
    await setup({
      entries: [
        entry('a', 'pushup', '2026-09-02T08:00:00', 10),
        entry('b', 'pull.pullups', '2026-09-03T08:00:00', 5),
      ],
      hidden: ['pushup'],
    });

    // then
    expect(screen.getByTestId('analysis-xp-total').textContent?.trim()).toBe(
      '10'
    );
  });

  it('should explain an empty range instead of drawing empty bars', async () => {
    // given
    await setup({ entries: [] });

    // then
    expect(screen.getByText(/noch keine XP gesammelt/)).toBeTruthy();
    expect(screen.queryByTestId('analysis-xp-bars')).toBeNull();
  });

  it('should show a skeleton while XP is loading', async () => {
    // given
    await setup({ entries: [], loaded: false });

    // then
    expect(screen.queryByTestId('analysis-xp-total')).toBeNull();
    expect(TestBed.inject(XpStore)).toBeTruthy();
  });
});
