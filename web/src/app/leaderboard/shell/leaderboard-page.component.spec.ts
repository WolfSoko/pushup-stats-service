import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import {
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
});
