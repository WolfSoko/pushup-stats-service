import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { FirebaseApp } from '@angular/fire/app';
import { BehaviorSubject } from 'rxjs';
import { PublicProfileApiService } from '@pu-stats/data-access';
import { type PublicProfile } from '@pu-stats/models';
import { PublicProfilePageComponent } from './public-profile-page.component';
import { ShareService } from '../core/share.service';
import { SeoService } from '../core/seo.service';
import { UserConfigStore } from '../core/user-config.store';
import { ProfilePhotoService } from '../core/profile-photo.service';
import { signal } from '@angular/core';
import { FriendsStore } from '../friends/friends.store';

const firebaseAppMock = {
  options: { projectId: 'pushup-stats' },
} as unknown as FirebaseApp;

const sampleProfile: PublicProfile = {
  uid: 'abcdef1234567890',
  displayName: 'Wolfi',
  total: 5000,
  totalEntries: 200,
  totalDays: 90,
  currentStreak: 14,
  bestSingleEntry: 50,
  bestDayTotal: 250,
  achievements: [],
  photoURL: null,
  memberSince: null,
  weeklyReps: 0,
  monthlyReps: 0,
  heatmap: {},
  exercises: [],
  isPrivate: false,
  viewerIsOwner: false,
  hidden: [],
  visibility: {},
  viewerIsFriend: false,
  updatedAt: '2026-04-29T08:30:00.000Z',
};

describe('PublicProfilePageComponent', () => {
  let fixture: ComponentFixture<PublicProfilePageComponent>;
  const apiMock = {
    getProfile: vitest.fn<(uid: string) => Promise<PublicProfile | null>>(),
  };
  const shareMock = { share: vitest.fn().mockResolvedValue('native') };
  const seoMock = { update: vitest.fn() };
  const configMock = {
    config: signal<Record<string, unknown> | null>({
      ui: { publicProfile: true, hideFromLeaderboard: true },
    }),
    save: vitest.fn().mockResolvedValue({}),
  };
  const photosMock = {
    busy: signal(false),
    upload: vitest.fn().mockResolvedValue({ ok: true }),
  };

  function makeRoute(uid: string | null): ActivatedRoute {
    const params = uid ? { uid } : {};
    const map = convertToParamMap(params);
    return {
      paramMap: new BehaviorSubject<ParamMap>(map).asObservable(),
      snapshot: { paramMap: map },
    } as unknown as ActivatedRoute;
  }

  async function setup(
    options: {
      uid?: string | null;
      resolve?: PublicProfile | null;
      reject?: unknown;
      extraProviders?: unknown[];
    } = {}
  ): Promise<void> {
    vitest.clearAllMocks();
    if (options.reject !== undefined) {
      apiMock.getProfile.mockRejectedValue(options.reject);
    } else {
      apiMock.getProfile.mockResolvedValue(options.resolve ?? null);
    }

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PublicProfilePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: makeRoute(
            options.uid === undefined ? sampleProfile.uid : options.uid
          ),
        },
        { provide: PublicProfileApiService, useValue: apiMock },
        { provide: ShareService, useValue: shareMock },
        { provide: SeoService, useValue: seoMock },
        { provide: FirebaseApp, useValue: firebaseAppMock },
        { provide: UserConfigStore, useValue: configMock },
        { provide: ProfilePhotoService, useValue: photosMock },
        // Pin the locale so the share-URL assertion below is deterministic
        // (the unit-test default differs per Angular setup; pinning here
        // documents which prefix the share builder should pick).
        { provide: LOCALE_ID, useValue: 'en-US' },
        ...((options.extraProviders ?? []) as never[]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicProfilePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('Given the API returns a profile', () => {
    it('Then it renders the displayName, total reps and streak', async () => {
      await setup({ resolve: sampleProfile });

      const root = fixture.nativeElement as HTMLElement;
      expect(
        root.querySelector('[data-testid="public-profile-name"]')?.textContent
      ).toContain('Wolfi');
      // The number pipe formats with the active LOCALE_ID (en-US in tests),
      // so 5000 renders as "5,000". Match the digits regardless of grouping
      // separator so changing LOCALE_ID for tests doesn't break the assertion.
      expect(
        root
          .querySelector('[data-testid="public-profile-total"]')
          ?.textContent?.replace(/[,.\s]/g, '')
      ).toContain('5000');
      expect(
        root.querySelector('[data-testid="public-profile-streak"]')?.textContent
      ).toContain('14');
    });

    it('Then it sets SEO meta tags including the displayName', async () => {
      await setup({ resolve: sampleProfile });

      expect(seoMock.update).toHaveBeenCalled();
      const args = seoMock.update.mock.calls.at(-1);
      if (!args) return;
      expect(args[0]).toContain('Wolfi');
      expect(args[2]).toBe('/u/abcdef1234567890');
    });

    it('Then clicking share forwards the profile URL to ShareService', async () => {
      await setup({ resolve: sampleProfile });

      const button = fixture.nativeElement.querySelector(
        '[data-testid="public-profile-share"]'
      ) as HTMLButtonElement;
      button.click();
      await fixture.whenStable();

      expect(shareMock.share).toHaveBeenCalledTimes(1);
      const payload = shareMock.share.mock.calls[0][0];
      // Share URL must include the locale prefix so the recipient lands on
      // the right Angular bundle directly — bare `/u/<uid>` requires the
      // SSR redirect and wouldn't survive a client cache or copy-paste
      // through tools that strip 30x hops. Tests run with the default
      // LOCALE_ID `en-US`, so we assert the exact `/en/...` URL — going
      // permissive (matching `(de|en)`) would let a regression silently
      // map every locale to the source fallback.
      expect(payload.url).toBe(
        'https://pushup-stats.com/en/u/abcdef1234567890'
      );
      expect(payload.text).toContain('Wolfi');
      expect(payload.text).toContain('5000');
    });
  });

  describe('Given the API returns null (private/unknown user)', () => {
    it('Then it shows the not-found state', async () => {
      await setup({ resolve: null });

      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-not-found"]'
        )
      ).toBeTruthy();
      // Privacy regression: never display the queried UID, so an attacker
      // can't confirm whether the user exists.
      expect(fixture.nativeElement.textContent).not.toContain(
        sampleProfile.uid
      );
    });
  });

  describe('Given the API rejects with an error', () => {
    it('Then it shows the error state with a retry button', async () => {
      await setup({ reject: new Error('boom') });

      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-error"]'
        )
      ).toBeTruthy();
    });
  });

  describe('Given the route has no uid param', () => {
    it('Then it shows not-found without calling the API', async () => {
      await setup({ uid: null });

      expect(apiMock.getProfile).not.toHaveBeenCalled();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-not-found"]'
        )
      ).toBeTruthy();
    });
  });

  describe('SEO and OG image wiring', () => {
    it('Sets a dynamic OG image URL pointing at the ogProfile function with URL-encoded UID + locale', async () => {
      await setup({ resolve: sampleProfile });

      const args: unknown[] | undefined = seoMock.update.mock.calls.at(-1);
      expect(args).toBeDefined();
      if (!args) return;
      const ogExtras = args[3] as
        { imageUrl?: string; imageAlt?: string } | undefined;
      // URL must be derived from the active FirebaseApp.options.projectId
      // so PR previews / staging / prod each hit their own function host.
      expect(ogExtras?.imageUrl).toContain('-pushup-stats.cloudfunctions.net');
      expect(ogExtras?.imageUrl).toContain('ogProfile');
      expect(ogExtras?.imageUrl).toContain(
        encodeURIComponent(sampleProfile.uid)
      );
      expect(ogExtras?.imageUrl).toMatch(/[?&]lang=(de|en)/);
    });

    it('Sets an imageAlt that mentions the displayName', async () => {
      await setup({ resolve: sampleProfile });

      const args: unknown[] | undefined = seoMock.update.mock.calls.at(-1);
      expect(args).toBeDefined();
      if (!args) return;
      const ogExtras = args[3] as
        { imageUrl?: string; imageAlt?: string } | undefined;
      expect(ogExtras?.imageAlt).toContain('Wolfi');
    });

    it('Does not pass an imageUrl in the not-found state (no per-profile card to render)', async () => {
      await setup({ resolve: null });

      const args: unknown[] | undefined = seoMock.update.mock.calls.at(-1);
      expect(args).toBeDefined();
      if (!args) return;
      const ogExtras = args[3] as { imageUrl?: string } | undefined;
      expect(ogExtras?.imageUrl).toBeUndefined();
    });

    it('Includes the canonical path /u/:uid in the SEO call for a ready profile', async () => {
      await setup({ resolve: sampleProfile });

      const args: unknown[] | undefined = seoMock.update.mock.calls.at(-1);
      expect(args).toBeDefined();
      if (!args) return;
      expect(args[2]).toBe('/u/abcdef1234567890');
    });
  });

  describe('Private profile shown to its owner', () => {
    it('should show the hint AND the profile content', async () => {
      // given — the server hands the owner their own private profile;
      // replacing the content with a hint would hide exactly what the
      // owner came to look at
      await setup({ resolve: { ...sampleProfile, isPrivate: true } });

      // then
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-private"]'
        )
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-name"]'
        )
      ).not.toBeNull();
    });

    it('should link to the settings tab that flips the switch', async () => {
      // given
      await setup({ resolve: { ...sampleProfile, isPrivate: true } });

      // when
      const cta = fixture.nativeElement.querySelector(
        '[data-testid="public-profile-enable"]'
      ) as HTMLAnchorElement | null;

      // then
      expect(cta?.getAttribute('href')).toContain('/settings/profil');
    });

    it('should not show the hint on a public profile', async () => {
      // given
      await setup({ resolve: sampleProfile });

      // then
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-private"]'
        )
      ).toBeNull();
    });

    it('should still show the generic not-found when there is no profile', async () => {
      // given
      await setup({ resolve: null });

      // then
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-not-found"]'
        )
      ).not.toBeNull();
    });
  });

  describe('Heatmap and exercises', () => {
    it('should render seven weekday rows when there is heatmap data', async () => {
      // given
      await setup({
        resolve: { ...sampleProfile, heatmap: { 'Mo-08': 120, 'Fr-19': 40 } },
      });

      // then
      expect(
        fixture.nativeElement.querySelectorAll('.heatmap-day').length
      ).toBe(7);
    });

    it('should omit the heatmap entirely when nothing was logged', async () => {
      // given — a grid of blank cells says less than no section
      await setup({ resolve: sampleProfile });

      // then
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-heatmap"]'
        )
      ).toBeNull();
    });

    it('should render one bar per exercise, biggest at full width', async () => {
      // given
      await setup({
        resolve: {
          ...sampleProfile,
          exercises: [
            {
              exerciseId: 'pushup',
              total: 5000,
              totalDays: 90,
              measurement: 'reps' as const,
            },
            {
              exerciseId: 'plank.standard',
              total: 3600,
              totalDays: 40,
              measurement: 'time' as const,
            },
          ],
        },
      });

      // then
      const items = fixture.nativeElement.querySelectorAll(
        '.exercise-list li'
      ) as NodeListOf<HTMLElement>;
      expect(items.length).toBe(2);
      expect(
        items[0].querySelector('.exercise-bar span')?.getAttribute('style')
      ).toContain('100%');
    });

    it('should format each exercise in its own unit', async () => {
      // given — plank stores seconds, push-ups store reps; the same
      // number must not render the same way
      await setup({
        resolve: {
          ...sampleProfile,
          exercises: [
            {
              exerciseId: 'plank.standard',
              total: 3600,
              totalDays: 40,
              measurement: 'time' as const,
            },
          ],
        },
      });

      // then
      const value = fixture.nativeElement.querySelector('.exercise-value');
      expect(value?.textContent).toContain('h');
    });

    it('should omit the exercise section when there is nothing to show', async () => {
      // given
      await setup({ resolve: sampleProfile });

      // then
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-exercises"]'
        )
      ).toBeNull();
    });
  });

  describe('Profile photo', () => {
    it('should render the photo when one is set', async () => {
      // given
      await setup({
        resolve: { ...sampleProfile, photoURL: 'https://example.test/p.jpg' },
      });

      // then
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-photo"]'
        )
      ).not.toBeNull();
    });

    it('should fall back to the placeholder icon without a photo', async () => {
      // given
      await setup({ resolve: sampleProfile });

      // then
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-photo"]'
        )
      ).toBeNull();
    });
  });

  describe('Achievements', () => {
    it('should render one badge per earned achievement', async () => {
      // given
      await setup({
        resolve: {
          ...sampleProfile,
          achievements: ['plan-completed-core-4w-v1', 'plan-days-10'],
        },
      });

      // then
      const badges = fixture.nativeElement.querySelectorAll('.badge');
      expect(badges.length).toBe(2);
    });

    it('should omit the section entirely when nothing is earned', async () => {
      // given
      await setup({ resolve: sampleProfile });

      // then
      expect(fixture.nativeElement.querySelector('.achievements')).toBeNull();
    });

    it('should skip an id the catalog no longer knows', async () => {
      // given — a badge earned under an older catalog must not break the
      // page or render an empty chip
      await setup({
        resolve: { ...sampleProfile, achievements: ['plan-days-7'] },
      });

      // then
      expect(fixture.nativeElement.querySelector('.achievements')).toBeNull();
    });
  });

  describe('Share button visibility', () => {
    it('Renders the share button when a profile is loaded', async () => {
      await setup({ resolve: sampleProfile });

      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-share"]'
        )
      ).not.toBeNull();
    });

    it('Hides the share button on the not-found state', async () => {
      await setup({ resolve: null });

      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-share"]'
        )
      ).toBeNull();
    });
  });

  describe('Tagline', () => {
    it('should invite the visitor instead of naming the product', async () => {
      // given — a visitor arrives from someone else's shared link, so the
      // line under the name is the one chance to say why they should care
      await setup({ resolve: sampleProfile });

      // then
      const tagline = fixture.nativeElement.querySelector(
        '[data-testid="public-profile-tagline"]'
      );
      expect(tagline).toBeTruthy();
      expect(tagline.textContent.trim()).toBe(
        'Jeden Tag ein Stück stärker. Mach mit.'
      );
    });
  });

  describe('Owner controls', () => {
    const owner = (over: Partial<PublicProfile> = {}): PublicProfile => ({
      ...sampleProfile,
      viewerIsOwner: true,
      ...over,
    });
    const q = (sel: string) => fixture.nativeElement.querySelector(sel);

    it('should not show any switches to a visitor', async () => {
      // given — the controls are the owner's, and their mere presence
      // would tell a visitor the profile has hidden parts
      await setup({ resolve: sampleProfile });

      // then
      expect(q('[data-testid="profile-owner-bar"]')).toBeNull();
      expect(q('[data-testid="profile-toggle-streak"]')).toBeNull();
    });

    describe('Explaining the eye icons', () => {
      it('should describe both states at the top of the page', async () => {
        // given — an eye icon on its own does not say what it does, and
        // the icons carry the whole feature
        await setup({ resolve: owner() });

        // then
        const legend = q('[data-testid="profile-owner-legend"]');
        expect(legend).toBeTruthy();
        expect(legend.querySelectorAll('li').length).toBe(2);
      });

      it('should name both icons, not just the visible one', async () => {
        // given — the half that is easy to misread is the crossed-out
        // eye: it must say "hidden", not leave the user guessing
        await setup({ resolve: owner() });

        // then
        const icons = [
          ...q('[data-testid="profile-owner-legend"]').querySelectorAll(
            'mat-icon'
          ),
        ].map((i: Element) => i.textContent?.trim());
        expect(icons).toEqual(['visibility', 'visibility_off']);
      });

      it('should say the icons are private to the owner', async () => {
        // given
        await setup({ resolve: owner() });

        // then
        expect(q('[data-testid="profile-owner-hint"]').textContent).toContain(
          'nur du'
        );
      });

      it('should not appear for a visitor', async () => {
        // given
        await setup({ resolve: sampleProfile });

        // then
        expect(q('[data-testid="profile-owner-legend"]')).toBeNull();
      });
    });

    it('should show the switches to the owner', async () => {
      // given
      await setup({ resolve: owner() });

      // then
      expect(q('[data-testid="profile-owner-bar"]')).toBeTruthy();
      expect(q('[data-testid="profile-toggle-streak"]')).toBeTruthy();
    });

    it('should keep a switched-off element on screen for the owner', async () => {
      // given — removing it would take the switch that turns it back on
      // away with it
      await setup({
        resolve: owner({ visibility: { streak: 'off' } }),
      });

      // then
      expect(q('[data-testid="public-profile-streak"]')).toBeTruthy();
      expect(q('[data-testid="profile-toggle-streak"]')).toBeTruthy();
    });

    it('should mark a switched-off element as not published', async () => {
      // given
      await setup({
        resolve: owner({ visibility: { streak: 'off' } }),
      });

      // then — dimming is the only cue that it is off; without it the
      // page would look the same either way
      expect(
        q('[data-testid="public-profile-streak"]').closest('.is-hidden')
      ).toBeTruthy();
    });

    describe('Preview as visitor', () => {
      it('should not be offered while the profile is private', async () => {
        // given — there is no visitor view to preview yet
        await setup({ resolve: owner({ isPrivate: true }) });

        // then
        expect(q('[data-testid="profile-preview-toggle"]')).toBeNull();
      });

      it('should be offered once the profile is public', async () => {
        // given
        await setup({ resolve: owner({ isPrivate: false }) });

        // then
        expect(q('[data-testid="profile-preview-toggle"]')).toBeTruthy();
      });

      it('should drop switched-off elements entirely', async () => {
        // given
        await setup({
          resolve: owner({ visibility: { streak: 'off' } }),
        });

        // when
        fixture.componentInstance['previewAsVisitor'].set(true);
        fixture.detectChanges();

        // then — a preview that still showed it would be a lie about
        // what visitors get
        expect(q('[data-testid="public-profile-streak"]')).toBeNull();
      });

      it('should hide the switches themselves', async () => {
        // given
        await setup({ resolve: owner() });

        // when
        fixture.componentInstance['previewAsVisitor'].set(true);
        fixture.detectChanges();

        // then
        expect(q('[data-testid="profile-toggle-streak"]')).toBeNull();
      });
    });

    describe('Saving a switch', () => {
      it('should narrow a public element to friends on the first tap', async () => {
        // given a section everyone can see
        await setup({ resolve: owner({ visibility: { streak: 'public' } }) });

        // when
        q('[data-testid="profile-toggle-streak"]').click();
        await fixture.whenStable();

        // then — widest first, so one tap is the step most people want
        expect(configMock.save).toHaveBeenCalledWith(
          expect.objectContaining({
            ui: expect.objectContaining({
              profileVisibility: expect.objectContaining({
                streak: 'friends',
              }),
            }),
          })
        );
      });

      it('should switch a friends-only element off on the next tap', async () => {
        // given
        await setup({ resolve: owner({ visibility: { streak: 'friends' } }) });

        // when
        q('[data-testid="profile-toggle-streak"]').click();
        await fixture.whenStable();

        // then
        expect(configMock.save).toHaveBeenCalledWith(
          expect.objectContaining({
            ui: expect.objectContaining({
              profileVisibility: expect.objectContaining({ streak: 'off' }),
            }),
          })
        );
      });

      it('should come back round to public from off', async () => {
        // given — the cycle has to be closed, or a hidden element is
        // hidden forever
        await setup({ resolve: owner({ visibility: { streak: 'off' } }) });

        // when
        q('[data-testid="profile-toggle-streak"]').click();
        await fixture.whenStable();

        // then
        expect(configMock.save).toHaveBeenCalledWith(
          expect.objectContaining({
            ui: expect.objectContaining({
              profileVisibility: expect.objectContaining({ streak: 'public' }),
            }),
          })
        );
      });

      it('should not drop the other ui settings', async () => {
        // given — writing only the new key risks losing publicProfile,
        // which would quietly unpublish the profile
        await setup({ resolve: owner() });

        // when
        q('[data-testid="profile-toggle-streak"]').click();
        await fixture.whenStable();

        // then
        const ui = configMock.save.mock.calls[0][0].ui;
        expect(ui.publicProfile).toBe(true);
        expect(ui.hideFromLeaderboard).toBe(true);
      });

      it('should flip the element without waiting for the round trip', async () => {
        // given
        await setup({ resolve: owner() });

        // when
        q('[data-testid="profile-toggle-streak"]').click();
        fixture.detectChanges();

        // then — the projection still says visible; the local mirror is
        // what makes the switch feel like a switch
        expect(
          q('[data-testid="public-profile-streak"]').closest('.is-hidden')
        ).toBeTruthy();
      });
    });

    describe('Profile photo', () => {
      it('should not be clickable for a visitor', async () => {
        // given
        await setup({ resolve: sampleProfile });

        // then
        expect(q('[data-testid="profile-photo-edit"]')).toBeNull();
      });

      it('should open the picker for the owner', async () => {
        // given
        await setup({ resolve: owner() });

        // then
        expect(q('[data-testid="profile-photo-edit"]')).toBeTruthy();
        expect(q('[data-testid="profile-photo-input"]')).toBeTruthy();
      });

      it('should upload the picked file', async () => {
        // given
        await setup({ resolve: owner() });
        const input = q('[data-testid="profile-photo-input"]');
        const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
        Object.defineProperty(input, 'files', { value: [file] });

        // when
        input.dispatchEvent(new Event('change'));
        await fixture.whenStable();

        // then
        expect(photosMock.upload).toHaveBeenCalledWith(file);
      });
    });
  });

  describe('Adding a friend', () => {
    const visitorProfile = { ...sampleProfile, viewerIsOwner: false };

    function friendsMock(ok = true, reason?: string) {
      const requestFriend = vitest.fn().mockResolvedValue(ok);
      return {
        requestFriend,
        lastRejection: () => reason,
      };
    }

    it('should offer a request on a stranger profile', async () => {
      // given
      const friends = friendsMock();
      await setup({
        resolve: visitorProfile,
        extraProviders: [{ provide: FriendsStore, useValue: friends }],
      });

      // when
      const button = document.querySelector(
        '[data-testid="public-profile-add-friend"]'
      ) as HTMLButtonElement;
      expect(button).toBeTruthy();
      button.click();
      await fixture.whenStable();

      // then
      expect(friends.requestFriend).toHaveBeenCalledWith(visitorProfile.uid);
    });

    it('should not offer it on your own profile', async () => {
      // given
      await setup({ resolve: { ...sampleProfile, viewerIsOwner: true } });

      // then
      expect(
        document.querySelector('[data-testid="public-profile-add-friend"]')
      ).toBeNull();
    });

    it('should say so when the two are already friends', async () => {
      // given
      await setup({
        resolve: { ...visitorProfile, viewerIsFriend: true },
      });

      // then
      expect(
        document.querySelector('[data-testid="public-profile-add-friend"]')
      ).toBeNull();
      expect(document.body.textContent).toContain('Ihr seid Freunde');
    });
  });
});
