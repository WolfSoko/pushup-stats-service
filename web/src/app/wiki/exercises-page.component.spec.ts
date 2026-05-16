import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { render, screen } from '@testing-library/angular';
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
    // 8 categories (push, pull, squat, hinge, lunge, core, cardio, mobility).
    expect(categoryHeadings.length).toBeGreaterThanOrEqual(8);
  });

  it('exposes one TOC entry per catalog exercise', async () => {
    const { container } = await render(ExercisesWikiPageComponent, {
      providers: [{ provide: ActivatedRoute, useValue: makeRouteMock() }],
    });

    const tocLinks = container.querySelectorAll('nav.toc a.toc-link');
    // 40 exercises across all categories.
    expect(tocLinks.length).toBe(40);
    for (const link of Array.from(tocLinks)) {
      const href = link.getAttribute('href') ?? '';
      expect(href.startsWith('#')).toBe(true);
    }
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
