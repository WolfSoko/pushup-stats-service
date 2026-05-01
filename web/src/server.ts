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

// Redirect non-locale-prefixed app routes to /<lang>/... so paths like
// `/u/<uid>` (which only exist inside the locale-specific Angular bundles)
// don't 404 with `Cannot GET /u/<uid>` when shared as a bare URL.
//
// Angular's own SSR locale middleware only handles the root `/` redirect;
// every other unprefixed path is forwarded to Angular which has no matching
// route. We bridge that gap here, picking the locale from `Accept-Language`
// and falling back to the source locale `de`.
//
// Skipped:
//  - already-prefixed paths (`/de`, `/en` and any subpath thereof)
//  - well-known files rewritten to `/de/...` by the middleware above
//  - paths with a file extension (static assets like `/favicon.ico`)
//  - non-GET/HEAD methods (POSTs to API routes shouldn't be redirected)
const LOCALE_PREFIXES = new Set(['de', 'en']);
// Restrict path characters to the URL-safe app-route alphabet. Anything
// outside this falls through to Angular instead of being redirected — this
// is defense in depth against open-redirect / header-injection attacks
// flowing from the user-controlled `req.url` into the `Location` header
// (CodeQL js/server-side-unvalidated-url-redirection). Even though the
// `/<lang>` prefix already constrains the redirect target to the same
// origin, validating the dataflow source closes the finding cleanly.
const SAFE_REDIRECT_PATH_RE = /^\/[A-Za-z0-9/_\-.~%]*$/;
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const path = req.path;
  if (path === '/') return next();
  const firstSegment = path.split('/')[1] ?? '';
  if (LOCALE_PREFIXES.has(firstSegment)) return next();
  if (rootFiles.has(firstSegment)) return next();
  // Skip static assets (any path whose last segment carries a file extension).
  const lastSegment = path.split('/').pop() ?? '';
  if (lastSegment.includes('.')) return next();
  // Reject anything outside the safe character class — keeps weird inputs
  // (backslashes, CR/LF, control characters, exotic Unicode) out of the
  // Location header instead of trying to sanitise them.
  if (!SAFE_REDIRECT_PATH_RE.test(path)) return next();

  const accept = String(req.headers['accept-language'] ?? '').toLowerCase();
  const lang = /\ben(-|;|,|$)/.test(accept) ? 'en' : 'de';
  // Drop the original query/hash entirely: it isn't load-bearing for any
  // of the routes this redirect serves (`/u/<uid>`, `/login`, etc.) and
  // omitting it eliminates the second user-controlled string from the
  // Location header. The locale-prefixed app keeps its own routing, so a
  // crawler hitting `/u/<uid>` will still land on the right page.
  //
  // `res.vary` (instead of `setHeader('Vary', ...)`) APPENDS to whatever
  // upstream middleware (compression, CORS, …) may have already set —
  // overwriting can quietly break caching semantics elsewhere.
  res.vary('Accept-Language');
  res.redirect(302, `/${lang}${path}`);
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
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
