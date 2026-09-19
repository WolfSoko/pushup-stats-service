import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import type { UserConfig } from '@pu-stats/models';
import { Subject } from 'rxjs';

import {
  FeatureAnnouncementService,
  isDashboard,
  WORKOUTS_ANNOUNCEMENT,
} from './feature-announcement.service';
import { UserConfigStore } from './user-config.store';

describe('isDashboard', () => {
  it.each([
    ['/app', true],
    ['/de/app', true],
    ['/app?tab=x', true],
    ['/en/app/', true],
    ['/apps', false],
    ['/login', false],
    ['/u/abc', false],
  ])('should read %s as dashboard: %s', (url, expected) => {
    expect(isDashboard(url)).toBe(expected);
  });
});

describe('FeatureAnnouncementService', () => {
  const config = signal<UserConfig | null>(null);
  const events = new Subject<NavigationEnd>();
  const afterClosed = new Subject<unknown>();
  const open = vitest.fn(() => ({ afterClosed: () => afterClosed }));
  const markAnnouncementSeen = vitest.fn().mockResolvedValue(undefined);
  const isGuest = signal(false);

  function setup(url = '/app', platform = 'browser'): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        { provide: MatDialog, useValue: { open } },
        {
          provide: UserConfigStore,
          useValue: { config: config.asReadonly(), markAnnouncementSeen },
        },
        { provide: Router, useValue: { events, url } },
        { provide: UserContextService, useValue: { isGuest } },
      ],
    });
    TestBed.inject(FeatureAnnouncementService);
  }

  async function settle(): Promise<void> {
    TestBed.tick();
    for (let i = 0; i < 6; i++) await Promise.resolve();
    TestBed.tick();
  }

  /** The dialog component is dynamic-imported, so the open lands a chunk load later. */
  function opened(times: number): Promise<void> {
    return vitest.waitFor(() => expect(open).toHaveBeenCalledTimes(times));
  }

  beforeEach(() => {
    open.mockClear();
    markAnnouncementSeen.mockClear();
    config.set(null);
    isGuest.set(false);
  });

  it('should leave guests alone', async () => {
    // given — an anonymous session has no account for the walkthrough to follow
    isGuest.set(true);
    setup('/app');

    // when
    config.set({ userId: 'guest' } as UserConfig);
    await settle();

    // then
    expect(open).not.toHaveBeenCalled();
  });

  it('should open the walkthrough once the dashboard is up for a user who has not seen it', async () => {
    // given
    setup('/app');

    // when
    config.set({ userId: 'u1' } as UserConfig);
    await settle();

    // then
    await opened(1);
  });

  it('should remember the announcement once the dialog closes', async () => {
    // given
    setup('/app');
    config.set({ userId: 'u1' } as UserConfig);
    await settle();
    await opened(1);

    // when
    afterClosed.next('later');

    // then
    expect(markAnnouncementSeen).toHaveBeenCalledWith(WORKOUTS_ANNOUNCEMENT);
  });

  it('should stay quiet for a user who already saw it', async () => {
    // given
    setup('/app');

    // when
    config.set({
      userId: 'u1',
      ui: { seenAnnouncements: [WORKOUTS_ANNOUNCEMENT] },
    } as UserConfig);
    await settle();

    // then
    expect(open).not.toHaveBeenCalled();
  });

  it('should wait until the user reaches the dashboard', async () => {
    // given — signed in, but looking at a profile
    setup('/u/someone');
    config.set({ userId: 'u1' } as UserConfig);
    await settle();
    expect(open).not.toHaveBeenCalled();

    // when
    events.next(new NavigationEnd(1, '/app', '/app'));
    await settle();

    // then
    await opened(1);
  });

  it('should open at most once per app session', async () => {
    // given
    setup('/app');
    config.set({ userId: 'u1' } as UserConfig);
    await settle();
    await opened(1);

    // when — a config echo without the flag yet
    config.set({ userId: 'u1', ui: {} } as UserConfig);
    await settle();

    // then
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('should do nothing on the server', async () => {
    setup('/app', 'server');
    config.set({ userId: 'u1' } as UserConfig);
    await settle();
    expect(open).not.toHaveBeenCalled();
  });
});
