import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import {
  type LeaderboardEntry,
  type LeaderboardPeriod,
  LeaderboardStore,
} from '@pu-stats/data-access';
import { LeaderboardPageComponent } from './leaderboard-page.component';

/**
 * Frontend privacy guard: leaderboard rows only become a `<a>` linking to
 * `/u/<uid>` when the cloud function attached a `uid` (which itself
 * requires both leaderboard + publicProfile opt-ins). Anonymous-aliased
 * rows or opted-out users must stay plain text — these tests fail loudly
 * if the template ever degrades that contract.
 */
describe('LeaderboardPageComponent', () => {
  let fixture: ComponentFixture<LeaderboardPageComponent>;
  const entriesByPeriod: Record<LeaderboardPeriod, LeaderboardEntry[]> = {
    daily: [],
    last7: [],
    last30: [],
  };

  const storeMock = {
    entriesForPeriod: (
      period: () => LeaderboardPeriod
    ): (() => LeaderboardEntry[]) =>
      signal<LeaderboardEntry[]>(entriesByPeriod[period()]).asReadonly(),
    currentUserForPeriod: (): (() => LeaderboardEntry | null) =>
      signal<LeaderboardEntry | null>(null).asReadonly(),
    load: vitest.fn(),
  };

  async function setup(entries: LeaderboardEntry[]): Promise<void> {
    entriesByPeriod.daily = entries;
    entriesByPeriod.last7 = entries;
    entriesByPeriod.last30 = entries;

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LeaderboardPageComponent],
      providers: [
        provideRouter([]),
        { provide: LeaderboardStore, useValue: storeMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeaderboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('Given an entry with uid (both opt-ins on)', () => {
    it('Then the alias is rendered as a router link to /u/<uid>', async () => {
      await setup([{ rank: 1, alias: 'Alice', reps: 100, uid: 'abc123' }]);

      const root = fixture.nativeElement as HTMLElement;
      const link = root.querySelector(
        '[data-testid="leaderboard-link-1"]'
      ) as HTMLAnchorElement | null;
      expect(link).not.toBeNull();
      expect(link!.tagName).toBe('A');
      expect(link!.classList.contains('alias-link')).toBe(true);
      // routerLink="['/u', 'abc123']" → href in test = `/u/abc123`.
      expect(link!.getAttribute('href')).toBe('/u/abc123');
      expect(link!.textContent?.trim()).toBe('Alice');
    });
  });

  describe('Given an entry without uid (opted-out / anonymous)', () => {
    it('Then the alias is rendered as a plain span — never clickable', async () => {
      await setup([{ rank: 2, alias: 'anonym', reps: 50 }]);

      const root = fixture.nativeElement as HTMLElement;
      // Privacy regression: an anonymous-aliased row must NEVER carry an
      // anchor, otherwise the visible "anonym" label would be linkable
      // to a stable profile permalink.
      expect(
        root.querySelector('[data-testid="leaderboard-link-2"]')
      ).toBeNull();
      // Find the span that holds the alias text — it must not be inside an <a>.
      const spans = Array.from(
        root.querySelectorAll('li span.alias')
      ) as HTMLElement[];
      const aliasSpan = spans.find((s) => s.textContent?.trim() === 'anonym');
      expect(aliasSpan).toBeDefined();
      expect(aliasSpan!.closest('a')).toBeNull();
    });
  });

  describe('Given a mix of entries', () => {
    it('Then only opted-in rows are linked, opted-out rows stay plain text', async () => {
      await setup([
        { rank: 1, alias: 'Alice', reps: 100, uid: 'aaa' },
        { rank: 2, alias: 'anonym', reps: 80 },
        { rank: 3, alias: 'Bob', reps: 60 },
      ]);

      const root = fixture.nativeElement as HTMLElement;
      expect(
        root.querySelector('[data-testid="leaderboard-link-1"]')
      ).not.toBeNull();
      expect(
        root.querySelector('[data-testid="leaderboard-link-2"]')
      ).toBeNull();
      // Bob has no uid → plain span, no link.
      expect(
        root.querySelector('[data-testid="leaderboard-link-3"]')
      ).toBeNull();
    });
  });
});
