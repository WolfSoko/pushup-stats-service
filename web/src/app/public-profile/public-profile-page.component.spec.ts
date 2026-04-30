import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { PublicProfileApiService } from '@pu-stats/data-access';
import { type PublicProfile } from '@pu-stats/models';
import { PublicProfilePageComponent } from './public-profile-page.component';
import { ShareService } from '../core/share.service';
import { SeoService } from '../core/seo.service';

const sampleProfile: PublicProfile = {
  uid: 'abcdef1234567890',
  displayName: 'Wolfi',
  total: 5000,
  totalEntries: 200,
  totalDays: 90,
  currentStreak: 14,
  bestSingleEntry: 50,
  bestDayTotal: 250,
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
      expect(
        root.querySelector('[data-testid="public-profile-total"]')?.textContent
      ).toContain('5000');
      expect(
        root.querySelector('[data-testid="public-profile-streak"]')?.textContent
      ).toContain('14');
    });

    it('Then it sets SEO meta tags including the displayName', async () => {
      await setup({ resolve: sampleProfile });

      expect(seoMock.update).toHaveBeenCalled();
      const args = seoMock.update.mock.calls.at(-1)!;
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
      expect(payload.url).toBe('https://pushup-stats.de/u/abcdef1234567890');
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
});
