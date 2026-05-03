import * as Sentry from '@sentry/node';

import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { pino } from 'pino';
import { pinoHttp } from 'pino-http';

import {
  computeLocaleRedirect,
  rewriteWellKnownPath,
} from './server-locale-redirect';

const isProduction = process.env['NODE_ENV'] === 'production';

if (isProduction) {
  const release = process.env['GIT_SHA'] || undefined;

  Sentry.init({
    dsn: 'https://084cd4acd3e626148eba3a831d0e4bee@o1384048.ingest.us.sentry.io/4511089937219584',
    sendDefaultPii: true,
    release,
    environment: process.env['SENTRY_ENVIRONMENT'] ?? 'production',
    tracesSampleRate: 0.1,
  });
}

const logger = pino({
  name: 'pushup-ssr',
  level: 'info',
});

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.use(pinoHttp({ logger }));

const angularApp = new AngularNodeAppEngine();

// Serve root-level well-known files from the /de build output
// so they are available at the domain root for crawlers.
const rootFiles = new Set(['ads.txt', 'robots.txt', 'sitemap.xml']);
app.use((req, res, next) => {
  const file = req.path.slice(1);
  if (rootFiles.has(file)) {
    const originalSuffix = req.url.slice(req.path.length);
    req.url = `/de/${file}${originalSuffix}`;
    // Short cache – crawlers need fresh robots/sitemap, not the 1y static default
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  next();
});

// Serve files under `/.well-known/` from the /de build output. Used by
// Google's Digital Asset Links verifier (TWA / Android App Links) and
// by other domain-verification flows that REQUIRE the file to live at
// the unprefixed root path. The whitelist of allowed filenames lives
// in `./server-locale-redirect` so it stays unit-testable.
app.use((req, res, next) => {
  const rewritten = rewriteWellKnownPath(req.path);
  if (rewritten) {
    const originalSuffix = req.url.slice(req.path.length);
    req.url = `${rewritten}${originalSuffix}`;
    // Short cache so Bubblewrap fingerprint rotations propagate quickly
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  next();
});

// Redirect non-locale-prefixed app routes to /<lang>/... so paths like
// `/u/<uid>` (which only exist inside the locale-specific Angular bundles)
// don't 404 with `Cannot GET /u/<uid>` when shared as a bare URL.
//
// Pure decision logic + path/query validation lives in
// `./server-locale-redirect` so the routing semantics are unit-tested
// without spinning up Supertest. This wrapper only adapts request fields
// in and applies the result out.
//
// Production-only: the Angular dev server (`nx serve`) shares this same
// `reqHandler` but disables localization, so `/de/login` etc. don't
// exist in dev builds. Redirecting unprefixed paths there breaks
// `nx serve` and any e2e suite that hits `/login` directly. The locale
// prefixes only really exist in the localized SSR build.
//
// `res.vary` (instead of `setHeader('Vary', ...)`) APPENDS to whatever
// upstream middleware (compression, CORS, …) may have already set —
// overwriting can quietly break caching semantics elsewhere.
if (isProduction) {
  app.use((req, res, next) => {
    const result = computeLocaleRedirect({
      method: req.method,
      path: req.path,
      url: req.originalUrl ?? req.url,
      acceptLanguage:
        typeof req.headers['accept-language'] === 'string'
          ? req.headers['accept-language']
          : undefined,
    });
    if (result.kind === 'pass') return next();
    res.vary('Accept-Language');
    res.redirect(302, result.location);
  });
}

/**
 * Serve static files from /browser.
 *
 * `dotfiles: 'allow'` is REQUIRED — `serve-static`'s default is `'ignore'`,
 * which silently drops any path containing a dot-prefixed segment. The
 * `.well-known` rewrite middleware above maps requests to
 * `/de/.well-known/<file>`; without `'allow'` those requests fall through
 * to the Angular SSR engine (which has no matching route) and Google's
 * Digital Asset Links / TWA verifier sees a 404 instead of the JSON.
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    dotfiles: 'allow',
  })
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

// Sentry error handler must be registered after all routes
if (isProduction) {
  Sentry.setupExpressErrorHandler(app);
}

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 8787;

  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    logger.info(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
