import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import type { UserConfig } from '@pu-stats/models';
import { Subject } from 'rxjs';

import { GENERATED_BLOG_POSTS } from '../blog/generated';
import {
  ANNOUNCEMENTS,
  FeatureAnnouncementService,
  INBOX_ANNOUNCEMENT,
  isDashboard,
  REBRAND_ANNOUNCEMENT,
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

describe('ANNOUNCEMENTS', () => {
  it('should never reuse an id', () => {
    // then — an id is what marks a walkthrough as seen per account
    const ids = ANNOUNCEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(WORKOUTS_ANNOUNCEMENT);
    expect(ids).toContain(REBRAND_ANNOUNCEMENT);
  });

  it.each(
    ANNOUNCEMENTS.filter((a) => a.url.startsWith('/blog/')).map((a) => [
      a.id,
      a.url,
    ])
  )('should point %s at a blog post that exists (%s)', (_id, url) => {
    // given an announcement whose inbox row links into the blog
    const slug = url.slice('/blog/'.length);

    // when looking the slug up in the generated posts
    const post = GENERATED_BLOG_POSTS.find((p) => p.slug === slug);

    // then it resolves — a typo here would send every account that opens
    // the walkthrough to a 404, and the id is burned once they see it
    expect(post).toBeDefined();
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

  it('should stay quiet for a user who already saw every announcement', async () => {
    // given
    setup('/app');

    // when
    config.set({
      userId: 'u1',
      ui: { seenAnnouncements: ANNOUNCEMENTS.map((a) => a.id) },
    } as UserConfig);
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // then
    expect(open).not.toHaveBeenCalled();
  });

  it('should move on to the next announcement once an older one is seen', async () => {
    // given
    setup('/app');

    // when — only the older walkthrough has been seen
    config.set({
      userId: 'u1',
      ui: { seenAnnouncements: [WORKOUTS_ANNOUNCEMENT] },
    } as UserConfig);

    // then
    await opened(1);
    afterClosed.next('later');
    expect(markAnnouncementSeen).toHaveBeenCalledWith(INBOX_ANNOUNCEMENT);
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
