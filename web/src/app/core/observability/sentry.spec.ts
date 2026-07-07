import { ApplicationRef, ErrorHandler } from '@angular/core';
import { DeferredSentryErrorHandler, initSentryLazily } from './sentry';

const sentryInit = vi.fn();
const browserTracingIntegration = vi.fn(() => ({ name: 'BrowserTracing' }));
const replayIntegration = vi.fn(() => ({ name: 'Replay' }));
const realErrorHandler = { handleError: vi.fn() };
const createErrorHandler = vi.fn(() => realErrorHandler);

vi.mock('@sentry/angular', () => ({
  init: (...args: unknown[]) => sentryInit(...args),
  browserTracingIntegration: () => browserTracingIntegration(),
  replayIntegration: () => replayIntegration(),
  createErrorHandler: () => createErrorHandler(),
}));

const config = {
  dsn: 'https://example@sentry.io/1',
  release: 'rel-1',
  environment: 'production',
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
};

describe('DeferredSentryErrorHandler', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('should log and buffer errors until a delegate is adopted', () => {
    // given
    const handler = new DeferredSentryErrorHandler();
    const error = new Error('before sentry');

    // when
    handler.handleError(error);

    // then
    expect(consoleError).toHaveBeenCalledWith(error);
  });

  it('should flush buffered errors to the delegate on adopt, in order', () => {
    // given
    const handler = new DeferredSentryErrorHandler();
    const first = new Error('first');
    const second = new Error('second');
    handler.handleError(first);
    handler.handleError(second);
    const delegate = { handleError: vi.fn() };

    // when
    handler.adopt(delegate);

    // then
    expect(delegate.handleError).toHaveBeenNthCalledWith(1, first);
    expect(delegate.handleError).toHaveBeenNthCalledWith(2, second);
  });

  it('should forward new errors straight to the delegate after adopt', () => {
    // given
    const handler = new DeferredSentryErrorHandler();
    const delegate = { handleError: vi.fn() };
    handler.adopt(delegate);
    const error = new Error('after sentry');

    // when
    handler.handleError(error);

    // then
    expect(delegate.handleError).toHaveBeenCalledWith(error);
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe('initSentryLazily', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sentryInit.mockClear();
    createErrorHandler.mockClear();
    realErrorHandler.handleError.mockClear();
    consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  // Under the non-isolated `web` runner (isolate: false) `console` is shared
  // across every spec file. An un-restored `vi.spyOn(console, 'error')` stays
  // installed, so a later `vi.spyOn(console, 'error')` in another file returns
  // this same mock together with its call history — surfacing phantom calls in
  // unrelated tests. Always restore console spies. See docs/gotchas/testing.md.
  afterEach(() => {
    consoleError.mockRestore();
  });

  function appRefWith(handler: ErrorHandler): ApplicationRef {
    return {
      injector: {
        get: (token: unknown) => (token === ErrorHandler ? handler : null),
      },
    } as unknown as ApplicationRef;
  }

  it('should init Sentry with tracing + replay integrations and the given config', async () => {
    // given
    const handler = new DeferredSentryErrorHandler();

    // when
    await initSentryLazily(appRefWith(handler), config);

    // then
    expect(sentryInit).toHaveBeenCalledTimes(1);
    const options = sentryInit.mock.calls[0][0];
    expect(options.dsn).toBe(config.dsn);
    expect(options.release).toBe(config.release);
    expect(options.tracesSampleRate).toBe(config.tracesSampleRate);
    expect(options.integrations).toEqual([
      { name: 'BrowserTracing' },
      { name: 'Replay' },
    ]);
  });

  it('should adopt the live Sentry error handler so buffered errors flush', async () => {
    // given
    const handler = new DeferredSentryErrorHandler();
    const buffered = new Error('startup');
    handler.handleError(buffered);

    // when
    await initSentryLazily(appRefWith(handler), config);

    // then
    expect(createErrorHandler).toHaveBeenCalledTimes(1);
    expect(realErrorHandler.handleError).toHaveBeenCalledWith(buffered);
  });
});
