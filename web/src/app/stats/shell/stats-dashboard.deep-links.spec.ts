import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  type Params,
  Router,
} from '@angular/router';
import { QUICK_LOG_REPS_MAX, QUICK_LOG_REPS_MIN } from '@pu-stats/models';

import { registerDashboardDeepLinks } from './stats-dashboard.deep-links';

function setup(params: Params) {
  const openCreateDialog = vitest.fn();
  const quickLog = vitest.fn();
  const navigate = vitest.fn().mockResolvedValue(true);
  const route = {
    snapshot: { queryParamMap: convertToParamMap(params) },
  } as unknown as ActivatedRoute;
  const router = { navigate } as unknown as Router;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  TestBed.runInInjectionContext(() =>
    registerDashboardDeepLinks({ route, router, openCreateDialog, quickLog })
  );
  TestBed.tick();
  return { openCreateDialog, quickLog, navigate };
}

/** The `queryParams` patch of the last `router.navigate` call. */
function clearedParams(navigate: ReturnType<typeof vitest.fn>): unknown {
  return navigate.mock.calls.at(-1)?.[1]?.queryParams;
}

describe('registerDashboardDeepLinks', () => {
  it('should log an in-range quickLog and clear the param', () => {
    // given / when
    const { quickLog, navigate } = setup({ quickLog: '20' });

    // then
    expect(quickLog).toHaveBeenCalledWith(20);
    expect(clearedParams(navigate)).toEqual({ quickLog: null });
  });

  it('should clamp a quickLog above the maximum', () => {
    // given a tampered deep-link
    const { quickLog } = setup({ quickLog: '99999' });

    // then the entry stays inside the configured range
    expect(quickLog).toHaveBeenCalledWith(QUICK_LOG_REPS_MAX);
  });

  it('should floor a fractional quickLog', () => {
    // given / when
    const { quickLog } = setup({ quickLog: '20.9' });

    // then
    expect(quickLog).toHaveBeenCalledWith(20);
  });

  it('should ignore a quickLog below the minimum', () => {
    // given a value under the configured floor
    const { quickLog, navigate } = setup({
      quickLog: String(QUICK_LOG_REPS_MIN - 1),
    });

    // then nothing is logged and the URL is left alone
    expect(quickLog).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should ignore a non-numeric quickLog', () => {
    // given / when
    const { quickLog, navigate } = setup({ quickLog: 'drop-table' });

    // then
    expect(quickLog).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should open the entry dialog for ?log=1 and clear the param', () => {
    // given / when
    const { openCreateDialog, navigate } = setup({ log: '1' });

    // then
    expect(openCreateDialog).toHaveBeenCalledTimes(1);
    expect(clearedParams(navigate)).toEqual({ log: null });
  });

  it('should let a snooze deep-link suppress both actions', () => {
    // given a combined URL — the user snoozed, they did not ask to log
    const { quickLog, openCreateDialog, navigate } = setup({
      snooze: '30',
      quickLog: '20',
      log: '1',
    });

    // then
    expect(quickLog).not.toHaveBeenCalled();
    expect(openCreateDialog).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
