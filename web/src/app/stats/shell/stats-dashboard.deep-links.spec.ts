import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  type Params,
  Router,
} from '@angular/router';

import { registerDashboardDeepLinks } from './stats-dashboard.deep-links';

function setup(params: Params) {
  const openCreateDialog = vitest.fn();
  const navigate = vitest.fn().mockResolvedValue(true);
  const route = {
    snapshot: { queryParamMap: convertToParamMap(params) },
  } as unknown as ActivatedRoute;
  const router = { navigate } as unknown as Router;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  TestBed.runInInjectionContext(() =>
    registerDashboardDeepLinks({ route, router, openCreateDialog })
  );
  TestBed.tick();
  return { openCreateDialog, navigate };
}

/** The `queryParams` patch of the last `router.navigate` call. */
function clearedParams(navigate: ReturnType<typeof vitest.fn>): unknown {
  return navigate.mock.calls.at(-1)?.[1]?.queryParams;
}

describe('registerDashboardDeepLinks', () => {
  it('should open the entry dialog for ?log=1 and clear the param', () => {
    // given / when
    const { openCreateDialog, navigate } = setup({ log: '1' });

    // then
    expect(openCreateDialog).toHaveBeenCalledTimes(1);
    expect(clearedParams(navigate)).toEqual({ log: null });
  });

  it('should ignore a log value other than 1', () => {
    // given / when
    const { openCreateDialog, navigate } = setup({ log: '0' });

    // then
    expect(openCreateDialog).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should do nothing without deep-link params', () => {
    // given / when
    const { openCreateDialog, navigate } = setup({});

    // then
    expect(openCreateDialog).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  // Regression: `?quickLog=N` used to persist an entry straight from the URL.
  // Android keeps that URL in the resumed PWA task, so every later resume
  // wrote another entry — one landed at 02:05, inside the user's quiet hours.
  // Quick-log now travels through the single-use intent store instead.
  it('should never persist an entry from a quickLog param', () => {
    // given a stale (or tampered) deep link
    const { openCreateDialog, navigate } = setup({ quickLog: '20' });

    // then nothing happens at all
    expect(openCreateDialog).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should ignore a snooze param — the intent store owns that now', () => {
    // given a deep link from an older service worker
    const { openCreateDialog, navigate } = setup({ snooze: '30', log: '1' });

    // then the log dialog still opens; the snooze is simply not this file's job
    expect(openCreateDialog).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
