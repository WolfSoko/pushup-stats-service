import { LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { ChallengesApiService } from '../../friends/challenges-api.service';
import { FriendsApiService } from '../../friends/friends-api.service';

import {
  AppSidenavComponent,
  resolveCurrentLocale,
} from './app-sidenav.component';
import { mainNavItems } from './main-nav-items';

async function setup(options: { loggedIn?: boolean; locale?: string } = {}) {
  const navigate = vitest.fn();
  const loggedIn = options.loggedIn ?? true;
  const { fixture } = await render(AppSidenavComponent, {
    inputs: {
      items: mainNavItems(loggedIn),
      loggedIn,
      profileUrl: '/u/u1',
    },
    on: { navigate },
    providers: [
      provideRouter([{ path: 'settings', children: [] }]),
      { provide: LOCALE_ID, useValue: options.locale ?? 'de-DE' },
      // The friends entry renders its request badge, which reads the
      // friends store; the real API needs the Functions injector.
      {
        provide: FriendsApiService,
        useValue: {
          list: () =>
            Promise.resolve({ friends: [], incoming: [], outgoing: [] }),
        },
      },
      {
        provide: ChallengesApiService,
        useValue: { list: () => Promise.resolve([]) },
      },
    ],
  });
  return { fixture, navigate };
}

function hrefs(): Array<string | null> {
  return Array.from(document.querySelectorAll('a[mat-list-item]')).map((a) =>
    a.getAttribute('href')
  );
}

describe('resolveCurrentLocale', () => {
  it.each([
    ['de-DE', 'de'],
    ['en-US', 'en'],
    ['zh', 'zh'],
    ['xx-YY', 'de'],
  ])('should coerce %s to %s', (localeId, expected) => {
    expect(resolveCurrentLocale(localeId)).toBe(expected);
  });
});

describe('AppSidenavComponent', () => {
  afterEach(() => {
    vitest.restoreAllMocks();
  });

  it('should list the same entries as the arc nav, plus profile and settings', async () => {
    // given
    await setup();

    // then — one list feeds both menus, so a page added to one cannot go
    // missing from the other
    expect(hrefs()).toEqual([
      ...mainNavItems(true).map((item) => item.path),
      '/u/u1',
      '/settings',
    ]);
    expect(screen.getByTestId('sidenav-profile').getAttribute('href')).toBe(
      '/u/u1'
    );
    expect(screen.getByTestId('sidenav-settings').getAttribute('href')).toBe(
      '/settings'
    );
  });

  it('should keep profile and settings from guests', async () => {
    // given
    await setup({ loggedIn: false });

    // then
    expect(hrefs()).toEqual(mainNavItems(false).map((item) => item.path));
    expect(screen.queryByTestId('sidenav-profile')).toBeNull();
  });

  it('should ask the shell to close the drawer when a link is followed', async () => {
    // given
    const { navigate } = await setup();

    // when
    await userEvent.setup().click(screen.getByTestId('sidenav-settings'));

    // then
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('should offer the language picker', async () => {
    await setup();
    expect(screen.getByText('Sprache')).toBeTruthy();
  });

  describe('setLanguage', () => {
    function mockLocation(location: {
      pathname: string;
      search?: string;
      hash?: string;
    }): ReturnType<typeof vitest.fn> {
      const replace = vitest.fn();
      vitest.spyOn(window, 'location', 'get').mockReturnValue({
        search: '',
        hash: '',
        ...location,
        replace,
      } as unknown as Location);
      return replace;
    }

    it('should preserve the current page path when switching from de to en', async () => {
      // given
      const { fixture, navigate } = await setup();
      const replace = mockLocation({ pathname: '/de/app' });

      // when
      fixture.componentInstance.setLanguage('en');

      // then — and the drawer closes on the way out
      expect(replace).toHaveBeenCalledWith('/en/app');
      expect(navigate).toHaveBeenCalled();
    });

    it('should preserve path and query when switching from en to de', async () => {
      const { fixture } = await setup({ locale: 'en-US' });
      const replace = mockLocation({
        pathname: '/en/settings',
        search: '?tab=profile',
      });

      fixture.componentInstance.setLanguage('de');

      expect(replace).toHaveBeenCalledWith('/de/settings?tab=profile');
    });

    it('should navigate to the locale root when on the landing page', async () => {
      const { fixture } = await setup();
      const replace = mockLocation({ pathname: '/de' });

      fixture.componentInstance.setLanguage('en');

      expect(replace).toHaveBeenCalledWith('/en/');
    });

    it('should preserve the hash fragment when switching language', async () => {
      const { fixture } = await setup();
      const replace = mockLocation({
        pathname: '/de/settings',
        search: '?tab=profile',
        hash: '#privacy',
      });

      fixture.componentInstance.setLanguage('en');

      expect(replace).toHaveBeenCalledWith('/en/settings?tab=profile#privacy');
    });

    // Regression: the prefix-stripping regex is driven by
    // SUPPORTED_LOCALES, so a typo in any of the codes would silently
    // break language switching. Smoke-test every one.
    it.each(['fr', 'es', 'it', 'nl', 'el', 'no', 'zh'] as const)(
      'should switch from /de/<path> to /%s/<path>',
      async (target) => {
        const { fixture } = await setup();
        const replace = mockLocation({ pathname: '/de/training-plans' });

        fixture.componentInstance.setLanguage(target);

        expect(replace).toHaveBeenCalledWith(`/${target}/training-plans`);
      }
    );

    it.each(['fr', 'es', 'it', 'nl', 'el', 'no', 'zh'] as const)(
      'should strip a /%s/ prefix when switching back to /de/',
      async (source) => {
        const { fixture } = await setup();
        const replace = mockLocation({ pathname: `/${source}/training-plans` });

        fixture.componentInstance.setLanguage('de');

        expect(replace).toHaveBeenCalledWith('/de/training-plans');
      }
    );
  });
});
