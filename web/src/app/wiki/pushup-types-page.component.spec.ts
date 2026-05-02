import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { PushupTypesPageComponent } from './pushup-types-page.component';

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

describe('PushupTypesPageComponent', () => {
  it('renders the page heading and intro', async () => {
    await render(PushupTypesPageComponent, {
      providers: [{ provide: ActivatedRoute, useValue: makeRouteMock() }],
    });

    expect(
      screen.getByRole('heading', {
        name: /Liegestütztypen/i,
        level: 1,
      })
    ).toBeTruthy();
  });

  it('renders a section with an anchor id for every catalog entry', async () => {
    const { container } = await render(PushupTypesPageComponent, {
      providers: [{ provide: ActivatedRoute, useValue: makeRouteMock() }],
    });

    // Each entry must have a section[id="<slug>"] so the wiki can be
    // deep-linked from training plan tooltips.
    const expectedSlugs = [
      'standard',
      'knie',
      'erhoeht',
      'weit',
      'diamant',
      'archer',
      'wand-einarmig',
      'negative-einarmig',
      'partielle-einarmig',
      'einarmig',
    ];
    for (const slug of expectedSlugs) {
      expect(container.querySelector(`section#${slug}`)).toBeTruthy();
    }
  });

  it('renders an ordered list of execution steps for the standard push-up', async () => {
    const { container } = await render(PushupTypesPageComponent, {
      providers: [{ provide: ActivatedRoute, useValue: makeRouteMock() }],
    });

    const standardSection = container.querySelector('section#standard');
    expect(standardSection).toBeTruthy();
    const steps = standardSection?.querySelectorAll('ol.instructions li');
    expect(steps?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('exposes a TOC entry per catalog type', async () => {
    const { container } = await render(PushupTypesPageComponent, {
      providers: [{ provide: ActivatedRoute, useValue: makeRouteMock() }],
    });

    const tocLinks = container.querySelectorAll('nav.toc ul li a');
    // 10 push-up types in the catalog.
    expect(tocLinks.length).toBe(10);
    // Each TOC link points at the matching section anchor.
    for (const link of Array.from(tocLinks)) {
      const href = link.getAttribute('href') ?? '';
      expect(href.startsWith('#')).toBe(true);
    }
  });
});
