import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  isRunFromToday,
  parseRunState,
  runDate,
  WorkoutRunStateService,
} from './workout-run-state';

const RUN = { startedAt: '2026-09-19T08:00:00+02:00', checked: [1] };

describe('parseRunState', () => {
  it('should read a stored run back', () => {
    expect(parseRunState(JSON.stringify(RUN))).toEqual(RUN);
  });

  it('should drop malformed ticks and refuse a run without a start', () => {
    expect(
      parseRunState(
        JSON.stringify({ startedAt: RUN.startedAt, checked: [1, 'x', -1] })
      )
    ).toEqual({ startedAt: RUN.startedAt, checked: [1] });
    expect(parseRunState(JSON.stringify({ checked: [] }))).toBeNull();
    expect(parseRunState('not json')).toBeNull();
    expect(parseRunState(null)).toBeNull();
  });
});

describe('isRunFromToday', () => {
  it('should keep only a run that started on the given day', () => {
    // then — the date comes off the local, offset-carrying timestamp
    expect(runDate(RUN)).toBe('2026-09-19');
    expect(isRunFromToday(RUN, '2026-09-19')).toBe(true);
    expect(isRunFromToday(RUN, '2026-09-20')).toBe(false);
    expect(isRunFromToday(null, '2026-09-19')).toBe(false);
  });
});

describe('WorkoutRunStateService', () => {
  function setup(platform: string): WorkoutRunStateService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platform }],
    });
    return TestBed.inject(WorkoutRunStateService);
  }

  afterEach(() => {
    localStorage.clear();
  });

  it('should persist a run per workout in the browser', () => {
    // given
    const service = setup('browser');

    // when
    service.save('w1', RUN);

    // then
    expect(service.load('w1')).toEqual(RUN);
    expect(service.load('w2')).toBeNull();
    service.clear('w1');
    expect(service.load('w1')).toBeNull();
  });

  it('should stay silent on the server', () => {
    // given
    const service = setup('server');

    // when
    service.save('w1', RUN);

    // then
    expect(service.load('w1')).toBeNull();
  });
});
