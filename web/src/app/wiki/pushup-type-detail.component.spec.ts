import { provideLocationMocks } from '@angular/common/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  Router,
  provideRouter,
} from '@angular/router';
import { render } from '@testing-library/angular';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PushupTypeDetailComponent } from './pushup-type-detail.component';

function makeRouteMock(slug: string) {
  return {
    paramMap: of(convertToParamMap({ slug })),
    queryParamMap: of(convertToParamMap({})),
    snapshot: {
      paramMap: convertToParamMap({ slug }),
      queryParamMap: convertToParamMap({}),
    },
  };
}

describe('PushupTypeDetailComponent', () => {
  it('renders the localized name as h1 for a known slug', async () => {
    const { container } = await render(PushupTypeDetailComponent, {
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: ActivatedRoute, useValue: makeRouteMock('standard') },
      ],
    });

    const h1 = container.querySelector('h1');
    expect(h1?.textContent?.toLowerCase()).toContain('standard');
  });

  it('renders an ordered list of execution steps for the standard push-up', async () => {
    const { container } = await render(PushupTypeDetailComponent, {
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: ActivatedRoute, useValue: makeRouteMock('standard') },
      ],
    });

    const steps = container.querySelectorAll('ol.instructions li');
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });

  it('redirects to the overview when the slug is unknown', async () => {
    const navigate = vi.fn().mockResolvedValue(true);
    await render(PushupTypeDetailComponent, {
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: ActivatedRoute, useValue: makeRouteMock('does-not-exist') },
        { provide: Router, useValue: { navigateByUrl: navigate } },
      ],
    });

    expect(navigate).toHaveBeenCalledWith('/wiki/liegestuetz-typen');
  });

  it('emits HowTo JSON-LD with one HowToStep per instruction', async () => {
    await render(PushupTypeDetailComponent, {
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: ActivatedRoute, useValue: makeRouteMock('standard') },
      ],
    });

    const ld = document.head.querySelector(
      'script[data-pushup-type-ld]'
    ) as HTMLScriptElement | null;
    expect(ld).toBeTruthy();
    if (!ld) return;
    const payload = JSON.parse(ld.textContent ?? '{}');
    expect(payload['@type']).toBe('HowTo');
    expect(Array.isArray(payload.step)).toBe(true);
    expect(payload.step.length).toBeGreaterThanOrEqual(3);
    expect(payload.step[0]['@type']).toBe('HowToStep');
    // Cleanup so subsequent tests don't see stale JSON-LD.
    ld?.remove();
  });

  it('renders a back link to the overview', async () => {
    const { container } = await render(PushupTypeDetailComponent, {
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: ActivatedRoute, useValue: makeRouteMock('diamant') },
      ],
    });

    const back = container.querySelector('a.back-link');
    expect(back).toBeTruthy();
    expect(back?.getAttribute('href')).toBe('/wiki/liegestuetz-typen');
  });

  it('should emit a noindex robots meta tag for the thin detail page', async () => {
    // given
    document.head.querySelector('meta[name="robots"]')?.remove();

    // when
    await render(PushupTypeDetailComponent, {
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: ActivatedRoute, useValue: makeRouteMock('standard') },
      ],
    });

    // then
    const robots = document.head.querySelector(
      'meta[name="robots"]'
    ) as HTMLMetaElement | null;
    expect(robots?.content).toBe('noindex,follow');
    robots?.remove();
  });
});
