import {
  formatStopwatch,
  StopwatchState,
  TargetSignal,
} from './stopwatch.state';

describe('StopwatchState', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should accumulate whole seconds while running and freeze on pause', () => {
    // given
    const state = new StopwatchState(true, 100);

    // when
    state.start();
    vi.advanceTimersByTime(2_500);

    // then
    expect(state.running()).toBe(true);
    expect(state.elapsedSec()).toBe(2);

    // when
    state.pause();
    vi.advanceTimersByTime(5_000);

    // then
    expect(state.running()).toBe(false);
    expect(state.elapsedSec()).toBe(2);
  });

  it('should not double-count the partial tick when paused between ticks', () => {
    // given
    const state = new StopwatchState(true, 1_000);
    state.start();

    // when
    vi.advanceTimersByTime(5_000);
    state.pause();

    // then
    expect(state.elapsedSec()).toBe(5);
  });

  it('should resume from the paused total via toggle', () => {
    // given
    const state = new StopwatchState(true, 100);
    state.toggle();
    vi.advanceTimersByTime(1_000);
    state.toggle();

    // when
    state.toggle();
    vi.advanceTimersByTime(2_000);
    state.pause();

    // then
    expect(state.elapsedSec()).toBe(3);
  });

  it('should reset to zero and stop', () => {
    // given
    const state = new StopwatchState(true, 100);
    state.start();
    vi.advanceTimersByTime(3_000);

    // when
    state.reset();

    // then
    expect(state.elapsedSec()).toBe(0);
    expect(state.running()).toBe(false);
  });

  it('should stay idle on the server', () => {
    // given
    const state = new StopwatchState(false, 100);

    // when
    state.start();
    vi.advanceTimersByTime(3_000);

    // then
    expect(state.running()).toBe(false);
    expect(state.elapsedSec()).toBe(0);
  });

  it('should stop ticking once destroyed', () => {
    // given
    const state = new StopwatchState(true, 100);
    state.start();
    vi.advanceTimersByTime(1_000);

    // when
    state.destroy();
    vi.advanceTimersByTime(4_000);

    // then
    expect(state.elapsedSec()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('formatStopwatch', () => {
  it('should pad minutes and seconds to two digits', () => {
    expect(formatStopwatch(0)).toBe('00:00');
    expect(formatStopwatch(50)).toBe('00:50');
    expect(formatStopwatch(95)).toBe('01:35');
    expect(formatStopwatch(3_725)).toBe('62:05');
  });

  it('should clamp negatives and fractions', () => {
    expect(formatStopwatch(-3)).toBe('00:00');
    expect(formatStopwatch(59.9)).toBe('00:59');
  });
});

describe('TargetSignal', () => {
  it('should fire once per crossing and re-arm after a reset', () => {
    // given
    const play = vi.fn();
    const signal = new TargetSignal(play);

    // when
    signal.update(false);
    signal.update(true);
    signal.update(true);

    // then
    expect(play).toHaveBeenCalledTimes(1);

    // when
    signal.update(false);
    signal.update(true);

    // then
    expect(play).toHaveBeenCalledTimes(2);
  });
});
