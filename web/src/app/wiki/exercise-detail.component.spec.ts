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
import { ExerciseDetailComponent } from './exercise-detail.component';

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

describe('ExerciseDetailComponent', () => {
  it('renders the localized name as h1 for a known slug', async () => {
    const { container } = await render(ExerciseDetailComponent, {
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: ActivatedRoute, useValue: makeRouteMock('squats') },
      ],
    });

    const h1 = container.querySelector('h1');
    expect(h1?.textContent?.toLowerCase()).toContain('niebeug');
  });

  it('renders the ordered list of execution steps', async () => {
    const { container } = await render(ExerciseDetailComponent, {
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: ActivatedRoute, useValue: makeRouteMock('plank') },
      ],
    });

    const steps = container.querySelectorAll('ol.instructions li');
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });

  it('redirects to the overview when the slug is unknown', async () => {
    const navigate = vi.fn().mockResolvedValue(true);
    await render(ExerciseDetailComponent, {
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: ActivatedRoute, useValue: makeRouteMock('does-not-exist') },
        { provide: Router, useValue: { navigateByUrl: navigate } },
      ],
    });

    expect(navigate).toHaveBeenCalledWith('/wiki/uebungen');
  });

  it('emits HowTo JSON-LD with one HowToStep per instruction', async () => {
    await render(ExerciseDetailComponent, {
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: ActivatedRoute, useValue: makeRouteMock('plank') },
      ],
    });

    const ld = document.head.querySelector(
      'script[data-exercise-ld]'
    ) as HTMLScriptElement | null;
    expect(ld).toBeTruthy();
    if (!ld) return;
    const payload = JSON.parse(ld.textContent ?? '{}');
    expect(payload['@type']).toBe('HowTo');
    expect(Array.isArray(payload.step)).toBe(true);
    expect(payload.step.length).toBeGreaterThanOrEqual(3);
    expect(payload.step[0]['@type']).toBe('HowToStep');
    ld?.remove();
  });

  it('renders a back link to the overview', async () => {
    const { container } = await render(ExerciseDetailComponent, {
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: ActivatedRoute, useValue: makeRouteMock('squats') },
      ],
    });

    const back = container.querySelector('a.back-link');
    expect(back).toBeTruthy();
    expect(back?.getAttribute('href')).toBe('/wiki/uebungen');
  });
});
