import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AdminAutoCountSectionComponent } from './admin-auto-count-section.component';
import type { AdminAutoCountFeedback } from './admin-page.models';
import { CallableFunctionsService } from './callable-functions.service';
import { createCallablesMock } from './callable-functions.testing';

const RESPONSE: AdminAutoCountFeedback = {
  totalReports: 43,
  summaries: [
    {
      profileId: 'pushup',
      mode: 'pose',
      thresholdKey: 'downAngleDeg=80',
      thresholds: { downAngleDeg: 80 },
      runs: 40,
      exactRuns: 36,
      exactRate: 0.9,
      meanDelta: 0.1,
      meanAbsDelta: 0.15,
    },
    {
      profileId: 'pushup',
      mode: 'pose',
      thresholdKey: '(default)',
      thresholds: {},
      runs: 3,
      exactRuns: 3,
      exactRate: 1,
      meanDelta: 0,
      meanAbsDelta: 0,
    },
  ],
  recent: [
    {
      id: 'r1',
      exerciseId: 'pushup',
      profileId: 'pushup',
      mode: 'pose',
      detectedReps: 10,
      actualReps: 12,
      thresholds: { downAngleDeg: 80 },
      userId: 'uid-1',
      createdAt: '2026-09-01T10:00:00.000Z',
    },
  ],
};

describe('AdminAutoCountSectionComponent', () => {
  let setupCallables: ReturnType<typeof createCallablesMock>['setupCallables'];

  const render = async () => {
    const fixture = TestBed.createComponent(AdminAutoCountSectionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    const mock = createCallablesMock();
    setupCallables = mock.setupCallables;
    TestBed.configureTestingModule({
      imports: [AdminAutoCountSectionComponent],
      providers: [
        { provide: CallableFunctionsService, useValue: mock.callablesMock },
      ],
    });
  });

  it('should render two skeleton tables instead of the empty text while the reports load', async () => {
    // given
    let resolve: (value: { data: AdminAutoCountFeedback }) => void = () =>
      undefined;
    const pending = new Promise<{ data: AdminAutoCountFeedback }>((r) => {
      resolve = r;
    });
    setupCallables([
      { name: 'adminListAutoCountFeedback', impl: () => pending },
    ]);

    // when
    const fixture = TestBed.createComponent(AdminAutoCountSectionComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    // then
    const skeleton = host.querySelector(
      '[data-testid="admin-auto-count-skeleton"]'
    );
    expect(skeleton?.getAttribute('aria-busy')).toBe('true');
    expect(skeleton?.querySelectorAll('pu-skeleton-table')).toHaveLength(2);
    expect(host.querySelector('mat-spinner')).toBeNull();
    expect(host.textContent).not.toContain('Noch keine Rückmeldungen');

    // when
    resolve({ data: RESPONSE });
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(host.querySelector('pu-skeleton-table')).toBeNull();
    expect(
      host.querySelector('[data-testid="admin-auto-count-summaries"]')
    ).toBeTruthy();
  });

  it('given reports exist, when the section loads, then each threshold set is compared', async () => {
    // given
    setupCallables([
      {
        name: 'adminListAutoCountFeedback',
        impl: async () => ({ data: RESPONSE }),
      },
    ]);

    // when
    const fixture = await render();

    // then
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('downAngleDeg 80');
    // The locale may put a non-breaking space before the percent sign.
    expect(text).toMatch(/90\s*%/u);
    expect(text).toContain('43 Rückmeldungen ausgewertet');
  });

  it('given a threshold set with few runs, when rendered, then it is flagged as thin evidence', async () => {
    // given
    setupCallables([
      {
        name: 'adminListAutoCountFeedback',
        impl: async () => ({ data: RESPONSE }),
      },
    ]);

    // when
    const fixture = await render();

    // then — the 3-run row carries the warning, the 40-run one does not
    const warnings = fixture.nativeElement.querySelectorAll('.thin-evidence');
    expect(warnings).toHaveLength(1);
  });

  it('given a run that missed reps, when listed, then the deviation shows a plus sign', async () => {
    // given
    setupCallables([
      {
        name: 'adminListAutoCountFeedback',
        impl: async () => ({ data: RESPONSE }),
      },
    ]);

    // when
    const fixture = await render();

    // then
    const recent = fixture.nativeElement.querySelector(
      '[data-testid="admin-auto-count-recent"]'
    ) as HTMLElement;
    expect(recent.textContent).toContain('+2');
  });

  it('given no reports yet, when the section loads, then it says so instead of showing empty tables', async () => {
    // given
    setupCallables([
      {
        name: 'adminListAutoCountFeedback',
        impl: async () => ({
          data: { summaries: [], recent: [], totalReports: 0 },
        }),
      },
    ]);

    // when
    const fixture = await render();

    // then
    expect(fixture.nativeElement.textContent).toContain(
      'Noch keine Rückmeldungen'
    );
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="admin-auto-count-summaries"]'
      )
    ).toBeNull();
  });

  it('given the callable fails, when the section loads, then the error is surfaced', async () => {
    // given
    setupCallables([
      {
        name: 'adminListAutoCountFeedback',
        impl: async () => {
          throw new Error('permission-denied');
        },
      },
    ]);

    // when
    const fixture = await render();

    // then
    const error = fixture.nativeElement.querySelector(
      '.error-text'
    ) as HTMLElement;
    expect(error.textContent).toContain('permission-denied');
  });
});
