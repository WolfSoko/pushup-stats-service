import { ApplicationRef, ErrorHandler, Injectable } from '@angular/core';

export interface SentryRuntimeConfig {
  dsn: string;
  release: string | undefined;
  environment: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
}

/**
 * ErrorHandler used while the Sentry SDK is still loading. Sentry init is
 * deferred to post-bootstrap idle time so `@sentry/*` stays out of the eager
 * bundle; until the real handler is adopted, errors are logged and buffered so
 * nothing thrown in the gap between bootstrap and Sentry coming online is lost.
 */
@Injectable()
export class DeferredSentryErrorHandler implements ErrorHandler {
  private delegate: ErrorHandler | null = null;
  private readonly buffered: unknown[] = [];

  handleError(error: unknown): void {
    if (this.delegate) {
      this.delegate.handleError(error);
      return;
    }
    console.error(error);
    this.buffered.push(error);
  }

  adopt(delegate: ErrorHandler): void {
    this.delegate = delegate;
    const pending = this.buffered.splice(0);
    for (const error of pending) delegate.handleError(error);
  }
}

/**
 * Loads and initialises the Sentry SDK (core + tracing + session replay) lazily
 * after bootstrap, then hands the live error handler to the
 * {@link DeferredSentryErrorHandler} so buffered startup errors are flushed.
 * Keeps the ~125 kB (transfer) `@sentry` chunk off the initial critical path.
 *
 * Route-aware transaction names previously provided by `TraceService` are
 * dropped in favour of `browserTracingIntegration`'s built-in pageload +
 * navigation instrumentation, which does not require an eager SDK import.
 */
export async function initSentryLazily(
  appRef: ApplicationRef,
  config: SentryRuntimeConfig
): Promise<void> {
  const Sentry = await import('@sentry/angular');
  Sentry.init({
    dsn: config.dsn,
    sendDefaultPii: true,
    release: config.release,
    environment: config.environment,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: config.tracesSampleRate,
    replaysSessionSampleRate: config.replaysSessionSampleRate,
    replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,
  });

  const handler = appRef.injector.get(ErrorHandler);
  if (handler instanceof DeferredSentryErrorHandler) {
    handler.adopt(Sentry.createErrorHandler());
  }
}
