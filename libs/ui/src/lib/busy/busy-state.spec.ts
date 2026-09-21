import { createBusyState, createKeyedBusyState } from './busy-state';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createBusyState', () => {
  it('should be idle until work is started', () => {
    // when
    const state = createBusyState();

    // then
    expect(state.busy()).toBe(false);
  });

  it('should be busy until the wrapped promise resolves and pass the result through', async () => {
    // given
    const state = createBusyState();
    const work = deferred<string>();

    // when
    const result = state.run(work.promise);

    // then
    expect(state.busy()).toBe(true);

    // when
    work.resolve('done');

    // then
    await expect(result).resolves.toBe('done');
    expect(state.busy()).toBe(false);
  });

  it('should accept a factory and settle on rejection', async () => {
    // given
    const state = createBusyState();

    // when
    const result = state.run(() => Promise.reject(new Error('nope')));

    // then
    expect(state.busy()).toBe(true);
    await expect(result).rejects.toThrow('nope');
    expect(state.busy()).toBe(false);
  });

  it('should stay busy while any of several runs is still pending', async () => {
    // given
    const state = createBusyState();
    const first = deferred<void>();
    const second = deferred<void>();
    void state.run(first.promise);
    void state.run(second.promise);

    // when
    first.resolve();
    await first.promise;
    await Promise.resolve();

    // then
    expect(state.busy()).toBe(true);

    // when
    second.resolve();
    await second.promise;
    await Promise.resolve();

    // then
    expect(state.busy()).toBe(false);
  });
});

describe('createKeyedBusyState', () => {
  it('should flag only the key whose work is pending', async () => {
    // given
    const state = createKeyedBusyState<string>();
    const work = deferred<void>();

    // when
    const result = state.run('row-1', work.promise);

    // then
    expect(state.isBusy('row-1')).toBe(true);
    expect(state.isBusy('row-2')).toBe(false);
    expect(state.busy()).toBe(true);
    expect([...state.busyKeys()]).toEqual(['row-1']);

    // when
    work.resolve();
    await result;

    // then
    expect(state.isBusy('row-1')).toBe(false);
    expect(state.busy()).toBe(false);
  });

  it('should keep a key busy until every run for it has settled', async () => {
    // given
    const state = createKeyedBusyState<number>();
    const first = deferred<void>();
    const second = deferred<void>();
    void state.run(7, first.promise);
    const secondRun = state.run(7, second.promise);

    // when
    first.resolve();
    await first.promise;
    await Promise.resolve();

    // then
    expect(state.isBusy(7)).toBe(true);

    // when
    second.reject(new Error('x'));

    // then
    await expect(secondRun).rejects.toThrow('x');
    expect(state.isBusy(7)).toBe(false);
  });
});
