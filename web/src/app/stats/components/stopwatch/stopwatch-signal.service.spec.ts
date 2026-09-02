import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { StopwatchSignalService } from './stopwatch-signal.service';

describe('StopwatchSignalService', () => {
  function setup(platform: 'browser' | 'server'): StopwatchSignalService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platform }],
    });
    return TestBed.inject(StopwatchSignalService);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should vibrate and beep through the Web Audio API in the browser', () => {
    // given
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
    });
    const osc = {
      frequency: { value: 0 },
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
    };
    const ctx = {
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn(() => osc),
      createGain: vi.fn(() => gain),
      resume: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          return ctx;
        }
      }
    );
    const service = setup('browser');

    // when
    service.play();

    // then
    expect(vibrate).toHaveBeenCalledWith([120, 80, 120]);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(osc.start).toHaveBeenCalledTimes(2);
  });

  it('should swallow a missing audio backend', () => {
    // given
    vi.stubGlobal('AudioContext', undefined);
    const service = setup('browser');

    // when / then
    expect(() => service.play()).not.toThrow();
  });

  it('should do nothing on the server', () => {
    // given
    const audioCtor = vi.fn();
    vi.stubGlobal('AudioContext', audioCtor);
    const service = setup('server');

    // when
    service.play();

    // then
    expect(audioCtor).not.toHaveBeenCalled();
  });
});
