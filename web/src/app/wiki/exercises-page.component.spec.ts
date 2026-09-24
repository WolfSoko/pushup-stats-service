import { EXERCISE_WIKI_CATALOG } from '@pu-stats/models';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { ExercisesWikiPageComponent } from './exercises-page.component';

function makeRouteMock(queryParams: Record<string, string> = {}) {
  return {
    paramMap: of(convertToParamMap({})),
    queryParamMap: of(convertToParamMap(queryParams)),
    snapshot: {
      paramMap: convertToParamMap({}),
      queryParamMap: convertToParamMap(queryParams),
    },
  };
}

describe('ExercisesWikiPageComponent', () => {
  it('renders the page heading and intro', async () => {
    await render(ExercisesWikiPageComponent, {
      providers: [{ provide: ActivatedRoute, useValue: makeRouteMock() }],
    });

    expect(
      screen.getByRole('heading', {
        name: /Übungen/i,
        level: 1,
      })
    ).toBeTruthy();
  });

  it('renders a section with an anchor id for the squat catalog entry', async () => {
    const { container } = await render(ExercisesWikiPageComponent, {
      providers: [{ provide: ActivatedRoute, useValue: makeRouteMock() }],
    });

    expect(container.querySelector('section#squats')).toBeTruthy();
    expect(container.querySelector('section#plank')).toBeTruthy();
    expect(container.querySelector('section#pullups')).toBeTruthy();
  });

  it('groups exercises under a category heading and lists at least one section per category', async () => {
    const { container } = await render(ExercisesWikiPageComponent, {
      providers: [{ provide: ActivatedRoute, useValue: makeRouteMock() }],
    });

    const categoryHeadings = container.querySelectorAll('h2.category-heading');
    // 8 catalog categories (push, pull, squat, hinge, lunge, core,
    // cardio, mobility) + 1 dedicated Liegestütze heading at the top
    // that hosts the cross-link card to the pushup-variants wiki.
    expect(categoryHeadings.length).toBeGreaterThanOrEqual(9);
  });

  it('renders the dedicated Liegestütze category heading before the first catalog category', async () => {
    const { container } = await render(ExercisesWikiPageComponent, {
      providers: [{ provide: ActivatedRoute, useValue: makeRouteMock() }],
    });

    const headings = Array.from(
      container.querySelectorAll('h2.category-heading')
    );
    // The pushup hub section must come first so users find the
    // foundational exercise without scrolling past every other category.
    expect(headings[0]?.textContent?.trim()).toBe('Liegestütze');
  });

  it('exposes one TOC entry per catalog exercise plus the pushup hub link', async () => {
    const { container } = await render(ExercisesWikiPageComponent, {
      providers: [{ provide: ActivatedRoute, useValue: makeRouteMock() }],
    });

    const tocLinks = container.querySelectorAll('nav.toc a.toc-link');
    // Every wiki entry plus the hub-card entry that cross-links to the
    // dedicated /wiki/liegestuetz-typen wiki under the "push" category.
    expect(tocLinks.length).toBe(EXERCISE_WIKI_CATALOG.length + 1);
    for (const link of Array.from(tocLinks)) {
      const href = link.getAttribute('href') ?? '';
      expect(href.startsWith('#')).toBe(true);
    }
  });

  it('renders a pushup-wiki hub card in the push category that links to /wiki/liegestuetz-typen', async () => {
    const { container } = await render(ExercisesWikiPageComponent, {
      providers: [{ provide: ActivatedRoute, useValue: makeRouteMock() }],
    });

    const hub = container.querySelector(
      '[data-testid="wiki-exercises-pushup-hub"]'
    );
    expect(hub).toBeTruthy();
    expect(hub?.getAttribute('id')).toBe('pushup-hub');

    const cta = container.querySelector(
      '[data-testid="wiki-exercises-pushup-hub-link"]'
    );
    expect(cta).toBeTruthy();
    expect(cta?.getAttribute('href')).toBe('/wiki/liegestuetz-typen');
  });

  it('renders an ordered instructions list for the squat section', async () => {
    const { container } = await render(ExercisesWikiPageComponent, {
      providers: [{ provide: ActivatedRoute, useValue: makeRouteMock() }],
    });

    const section = container.querySelector('section#squats');
    expect(section).toBeTruthy();
    const steps = section?.querySelectorAll('ol.instructions li');
    expect(steps?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});

describe('ExercisesWikiPageComponent search', () => {
  async function setup(queryParams: Record<string, string> = {}) {
    const result = await render(ExercisesWikiPageComponent, {
      providers: [
        { provide: ActivatedRoute, useValue: makeRouteMock(queryParams) },
      ],
    });
    const user = userEvent.setup();
    return { ...result, user };
  }

  it('should narrow the list to matching exercises and hide the overview', async () => {
    // given
    const { container, user } = await setup();

    // when
    await user.type(screen.getByTestId('wiki-exercises-search'), 'kniebeug');

    // then
    expect(container.querySelector('section#squats')).toBeTruthy();
    expect(container.querySelector('section#plank')).toBeNull();
    expect(container.querySelector('nav.toc')).toBeNull();
    expect(screen.queryByTestId('wiki-exercises-pushup-hub')).toBeNull();
    expect(
      screen.getByTestId('wiki-exercises-search-status').textContent
    ).toMatch(/gefunden/);
  });

  it('should focus the search field when the link asks for the search', async () => {
    // given / when
    await setup({ suche: '' });

    // then
    await vitest.waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByTestId('wiki-exercises-search')
      )
    );
  });

  it('should count the pushup hub as a result when only its text matches', async () => {
    // given
    const { user } = await setup();

    // when
    await user.type(
      screen.getByTestId('wiki-exercises-search'),
      'alle varianten'
    );

    // then
    expect(screen.getByTestId('wiki-exercises-pushup-hub')).toBeTruthy();
    expect(
      screen.getByTestId('wiki-exercises-search-status').textContent
    ).not.toMatch(/Keine/);
  });

  it('should prefill the search from the link', async () => {
    // given / when
    const { container } = await setup({ suche: 'plank' });

    // then
    expect(
      (screen.getByTestId('wiki-exercises-search') as HTMLInputElement).value
    ).toBe('plank');
    expect(container.querySelector('section#squats')).toBeNull();
  });

  it('should list matching pushup types under the pushup hub', async () => {
    // given
    const { user } = await setup();

    // when
    await user.type(screen.getByTestId('wiki-exercises-search'), 'diamant');

    // then
    const hits = screen.getByTestId('wiki-exercises-pushup-hits');
    expect(hits.textContent).toContain('Diamant');
    expect(hits.querySelector('a')?.getAttribute('href')).toBe(
      '/wiki/liegestuetz-typen/diamant'
    );
  });

  it('should say so when nothing matches and restore the list on reset', async () => {
    // given
    const { container, user } = await setup();
    await user.type(screen.getByTestId('wiki-exercises-search'), 'xyzzy');

    // when
    expect(screen.getByTestId('wiki-exercises-no-results')).toBeTruthy();
    await user.click(screen.getByText(/Alle Übungen zeigen/));

    // then
    expect(screen.queryByTestId('wiki-exercises-no-results')).toBeNull();
    expect(container.querySelector('section#plank')).toBeTruthy();
    expect(container.querySelector('nav.toc')).toBeTruthy();
  });

  it('should offer to start a session with an exercise', async () => {
    // given / when
    const { container } = await setup();

    // then
    const cta = container
      .querySelector('section#squats')
      ?.querySelector('[data-testid="wiki-exercises-new-session"]');
    expect(cta?.getAttribute('href')).toBe(
      '/workouts/new?exercise=legs.squats'
    );
  });
});
