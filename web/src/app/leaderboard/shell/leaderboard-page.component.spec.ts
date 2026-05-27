import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { computed, signal } from '@angular/core';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import {
  LEADERBOARD_PUSHUP_ID,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '@pu-stats/data-access';
import { LeaderboardStore } from '@pu-stats/data-access-state';
import { LeaderboardPageComponent } from './leaderboard-page.component';

/**
 * Frontend privacy guard: leaderboard rows only become a `<a>` linking
 * to `/u/<uid>` when the cloud function attached a `uid`. The ranker
 * now requires the full publicProfile opt-in, so every fresh row has a
 * uid; uid-less rows can only come from older cached snapshots and
 * must stay plain text. These tests fail loudly if the template ever
 * degrades that contract.
 *
 * Anonymous rows and opted-out users are filtered out at the
 * cloud-function layer (`rankEntries`) and never reach the frontend.
 */
describe('LeaderboardPageComponent', () => {
  let fixture: ComponentFixture<LeaderboardPageComponent>;
  const entriesByExerciseAndPeriod: Record<
    string,
    Record<LeaderboardPeriod, LeaderboardEntry[]>
  > = {};
  const lastUpdatedByExercise: Record<string, Date | null> = {};
  const loadMock = vitest.fn();

  function setEntries(exerciseId: string, entries: LeaderboardEntry[]): void {
    entriesByExerciseAndPeriod[exerciseId] = {
      daily: entries,
      last7: entries,
      last30: entries,
    };
  }

  const storeMock = {
    entriesForPeriod: (
      exerciseId: () => string,
      period: () => LeaderboardPeriod
    ): (() => LeaderboardEntry[]) =>
      // Compute reactively from the exerciseId/period selectors so
      // switching exercise via `selectExercise()` re-binds the list
      // without rebuilding the component.
      computed(
        () => entriesByExerciseAndPeriod[exerciseId()]?.[period()] ?? []
      ),
    currentUserForPeriod: (): (() => LeaderboardEntry | null) =>
      signal<LeaderboardEntry | null>(null).asReadonly(),
    lastUpdatedFor: (exerciseId: () => string): (() => Date | null) =>
      computed(() => lastUpdatedByExercise[exerciseId()] ?? null),
    load: loadMock,
  };

  async function setup(
    entries: LeaderboardEntry[],
    options?: { exerciseId?: string; updatedAt?: Date | null }
  ): Promise<void> {
    const exerciseId = options?.exerciseId ?? LEADERBOARD_PUSHUP_ID;
    setEntries(exerciseId, entries);
    lastUpdatedByExercise[exerciseId] = options?.updatedAt ?? null;

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LeaderboardPageComponent],
      providers: [
        provideRouter([]),
        { provide: LeaderboardStore, useValue: storeMock },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
        {
          provide: UserContextService,
          useValue: {
            userIdSafe: signal('').asReadonly(),
            isGuest: signal(false).asReadonly(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeaderboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    loadMock.mockClear();
    for (const key of Object.keys(entriesByExerciseAndPeriod)) {
      delete entriesByExerciseAndPeriod[key];
    }
    for (const key of Object.keys(lastUpdatedByExercise)) {
      delete lastUpdatedByExercise[key];
    }
  });

  describe('Given an entry with uid (both opt-ins on)', () => {
    it('Then the alias is rendered as a router link to /u/<uid>', async () => {
      await setup([{ rank: 1, alias: 'Alice', reps: 100, uid: 'abc123' }]);

      const root = fixture.nativeElement as HTMLElement;
      const link = root.querySelector(
        '[data-testid="leaderboard-link-1"]'
      ) as HTMLAnchorElement | null;
      expect(link).not.toBeNull();
      if (!link) return;
      expect(link.tagName).toBe('A');
      expect(link.classList.contains('alias-link')).toBe(true);
      // routerLink="['/u', 'abc123']" → href in test = `/u/abc123`.
      expect(link.getAttribute('href')).toBe('/u/abc123');
      expect(link.textContent?.trim()).toBe('Alice');
    });
  });

  describe('Given a legacy entry without uid (older cached snapshot)', () => {
    it('Then the alias is rendered as a plain span — never clickable', async () => {
      await setup([{ rank: 2, alias: 'Bob', reps: 50 }]);

      const root = fixture.nativeElement as HTMLElement;
      // Privacy regression: a row without `uid` must NEVER carry an
      // anchor, otherwise the alias would be linkable to a stable
      // profile permalink the user did not opt into.
      expect(
        root.querySelector('[data-testid="leaderboard-link-2"]')
      ).toBeNull();
      const spans = Array.from(
        root.querySelectorAll('li span.alias')
      ) as HTMLElement[];
      const aliasSpan = spans.find((s) => s.textContent?.trim() === 'Bob');
      expect(aliasSpan).toBeDefined();
      if (!aliasSpan) return;
      expect(aliasSpan.closest('a')).toBeNull();
    });
  });

  describe('Given a mix of fresh + legacy entries', () => {
    it('Then only rows with uid are linked, legacy uid-less rows stay plain text', async () => {
      await setup([
        { rank: 1, alias: 'Alice', reps: 100, uid: 'aaa' },
        { rank: 2, alias: 'Bob', reps: 80 },
        { rank: 3, alias: 'Carol', reps: 60 },
      ]);

      const root = fixture.nativeElement as HTMLElement;
      expect(
        root.querySelector('[data-testid="leaderboard-link-1"]')
      ).not.toBeNull();
      expect(
        root.querySelector('[data-testid="leaderboard-link-2"]')
      ).toBeNull();
      expect(
        root.querySelector('[data-testid="leaderboard-link-3"]')
      ).toBeNull();
    });
  });

  describe('Given the initial render', () => {
    it('Loads the pushup leaderboard by default', async () => {
      await setup([]);
      expect(loadMock).toHaveBeenCalledWith(LEADERBOARD_PUSHUP_ID);
    });

    it('Renders one popular-exercise chip per curated entry plus the pushup default', async () => {
      await setup([]);
      const root = fixture.nativeElement as HTMLElement;
      // Pushup chip is always rendered first.
      const pushupChip = root.querySelector(
        `[data-testid="leaderboard-exercise-chip-${LEADERBOARD_PUSHUP_ID}"]`
      );
      expect(pushupChip).not.toBeNull();
      // The popular row also surfaces high-traffic exercises.
      expect(
        root.querySelector(
          '[data-testid="leaderboard-exercise-chip-legs.squats"]'
        )
      ).not.toBeNull();
      expect(
        root.querySelector(
          '[data-testid="leaderboard-exercise-chip-pull.pullups"]'
        )
      ).not.toBeNull();
      expect(
        root.querySelector(
          '[data-testid="leaderboard-exercise-chip-cardio.running"]'
        )
      ).not.toBeNull();
    });
  });

  describe('Given a click on a non-default exercise chip', () => {
    it('Triggers a load for that exerciseId and re-binds the list to its bucket', async () => {
      // Given — pushup leaderboard is empty, squat leaderboard has rows.
      await setup([], { exerciseId: LEADERBOARD_PUSHUP_ID });
      setEntries('legs.squats', [
        { rank: 1, alias: 'Sue', reps: 50, uid: 'sue1' },
      ]);

      // When — the user clicks the Kniebeugen chip.
      const root = fixture.nativeElement as HTMLElement;
      const squatChip = root.querySelector(
        '[data-testid="leaderboard-exercise-chip-legs.squats"]'
      ) as HTMLButtonElement | null;
      expect(squatChip).not.toBeNull();
      squatChip?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Then — the store is asked to load the squat bucket.
      expect(loadMock).toHaveBeenCalledWith('legs.squats');

      // And — the list re-binds to the squat bucket. Sue's row is now
      // visible at rank 1.
      const link = root.querySelector(
        '[data-testid="leaderboard-link-1"]'
      ) as HTMLAnchorElement | null;
      expect(link?.textContent?.trim()).toBe('Sue');
    });
  });

  describe('Given a time-measured exercise like plank', () => {
    it('Formats the aggregated value as m:ss and omits the "Reps" suffix', async () => {
      // Given — 90 s plank aggregated to rank 1.
      await setup([{ rank: 1, alias: 'Tom', reps: 90, uid: 'tom1' }], {
        exerciseId: 'plank.standard',
      });

      // When — select via the component contract; mat-menu items render
      // in a cdk-overlay portal outside the component nativeElement,
      // so clicking through the DOM would couple the test to Material's
      // overlay-open lifecycle. The selection method IS the contract
      // the chip and menu both invoke.
      fixture.componentInstance.selectExercise('plank.standard');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Then — 90 s → "1:30" in the row, no trailing "Reps" label.
      const root = fixture.nativeElement as HTMLElement;
      const row = root.querySelector(
        'ol[data-testid="leaderboard-list"] li:first-child strong'
      ) as HTMLElement | null;
      expect(row).not.toBeNull();
      expect(row?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1:30');
    });
  });

  describe('Given a distance-time exercise like running', () => {
    it('Formats the aggregated meters as km when ≥ 1000', async () => {
      // Given — 5000 m aggregated to rank 1.
      await setup([{ rank: 1, alias: 'Rita', reps: 5000, uid: 'rita1' }], {
        exerciseId: 'cardio.running',
      });

      // When
      fixture.componentInstance.selectExercise('cardio.running');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Then — formatted as "5.00 km", "Reps" label suppressed.
      const root = fixture.nativeElement as HTMLElement;
      const row = root.querySelector(
        'ol[data-testid="leaderboard-list"] li:first-child strong'
      ) as HTMLElement | null;
      expect(row?.textContent?.replace(/\s+/g, ' ').trim()).toBe('5.00 km');
    });
  });

  describe('Given pushups (the default)', () => {
    it('Keeps the "Reps" label next to the value', async () => {
      // Given
      await setup([{ rank: 1, alias: 'Pia', reps: 25, uid: 'pia1' }]);

      // Then — bare number + "Reps" suffix matches the legacy template.
      const root = fixture.nativeElement as HTMLElement;
      const row = root.querySelector(
        'ol[data-testid="leaderboard-list"] li:first-child strong'
      ) as HTMLElement | null;
      expect(row?.textContent?.replace(/\s+/g, ' ').trim()).toBe('25 Reps');
    });
  });

  describe('Given the leaderboard carries an updatedAt timestamp', () => {
    it('Renders the "Zuletzt aktualisiert" line with a machine-readable <time>', async () => {
      // Given — server snapshot was rebuilt at a known instant.
      const updatedAt = new Date('2026-05-27T12:34:00Z');
      await setup([{ rank: 1, alias: 'Pia', reps: 25, uid: 'pia1' }], {
        updatedAt,
      });

      // Then — the freshness line is visible…
      const root = fixture.nativeElement as HTMLElement;
      const line = root.querySelector(
        '[data-testid="leaderboard-last-updated"]'
      ) as HTMLElement | null;
      expect(line).not.toBeNull();
      expect(line?.textContent ?? '').toContain('Zuletzt aktualisiert');

      // …and the embedded <time> uses ISO for machine reading so
      // assistive tech / scrapers don't rely on the localized
      // display string.
      const time = line?.querySelector('time') as HTMLTimeElement | null;
      expect(time).not.toBeNull();
      expect(time?.getAttribute('datetime')).toBe(updatedAt.toISOString());
      // The DatePipe output stays locale-stable enough for a simple
      // shape assertion — dd.MM.yyyy, HH:mm.
      expect(time?.textContent ?? '').toMatch(
        /\d{2}\.\d{2}\.\d{4},\s*\d{2}:\d{2}/
      );
    });

    it('Hides the line entirely when no timestamp is available yet', async () => {
      // Given — fresh load, no updatedAt cached (e.g. cold SSR).
      await setup([{ rank: 1, alias: 'Pia', reps: 25, uid: 'pia1' }]);

      // Then — the template must not surface "Zuletzt aktualisiert: —".
      const root = fixture.nativeElement as HTMLElement;
      expect(
        root.querySelector('[data-testid="leaderboard-last-updated"]')
      ).toBeNull();
    });
  });
});
