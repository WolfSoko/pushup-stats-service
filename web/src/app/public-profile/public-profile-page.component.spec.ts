import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { FirebaseApp } from '@angular/fire/app';
import { Auth } from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { PublicProfileApiService } from '@pu-stats/data-access';
import { type PublicProfile } from '@pu-stats/models';
/**
 * `onAuthStateChanged` is a module export, and ESM does not allow spying
 * on those — so the module is mocked once and the emitted user is steered
 * through `mockAuthUser` per test.
 */
let mockAuthUser: { uid: string } | null = null;
vitest.mock('@angular/fire/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@angular/fire/auth')>();
  // `Object.assign` rather than a spread: `vitest.mock` factories are
  // hoisted above esbuild's `__spreadValues` helper, which then blows up
  // at import time with "__spreadValues is not a function".
  return Object.assign({}, actual, {
    onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
      cb(mockAuthUser);
      return () => undefined;
    },
  });
});

import { PublicProfilePageComponent } from './public-profile-page.component';
import { ShareService } from '../core/share.service';
import { SeoService } from '../core/seo.service';

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
  updatedAt: '2026-04-29T08:30:00.000Z',
};

describe('PublicProfilePageComponent', () => {
  let fixture: ComponentFixture<PublicProfilePageComponent>;
  const apiMock = {
    getProfile: vitest.fn<(uid: string) => Promise<PublicProfile | null>>(),
  };
  const shareMock = { share: vitest.fn().mockResolvedValue('native') };
  const seoMock = { update: vitest.fn() };

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
      /** Provided only where ownership matters; absent = signed out / server. */
      auth?: unknown;
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
        // Pin the locale so the share-URL assertion below is deterministic
        // (the unit-test default differs per Angular setup; pinning here
        // documents which prefix the share builder should pick).
        { provide: LOCALE_ID, useValue: 'en-US' },
        ...(options.auth ? [{ provide: Auth, useValue: options.auth }] : []),
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

  describe('Own private profile', () => {
    afterEach(() => {
      mockAuthUser = null;
    });

    it('should offer to make it public when the visitor is the owner', async () => {
      // given — the "Mein Profil" entry sends every user here, and most
      // have not opted in yet; a generic "does not exist" page about
      // their own profile would be nonsense
      mockAuthUser = { uid: 'abcdef1234567890' };

      // when
      await setup({ resolve: null, auth: {} });

      // then
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-private"]'
        )
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-not-found"]'
        )
      ).toBeNull();
    });

    it('should show the generic not-found for someone else', async () => {
      // given
      mockAuthUser = { uid: 'ein-anderer' };

      // when
      await setup({ resolve: null, auth: {} });

      // then
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-private"]'
        )
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-not-found"]'
        )
      ).not.toBeNull();
    });

    it('should show the generic not-found for a signed-out visitor', async () => {
      // given — no Auth provider at all, as on the server
      // when
      await setup({ resolve: null });

      // then
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="public-profile-private"]'
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
});
