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

import { computeLocaleRedirect } from './server-locale-redirect';

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

// Serve `/.well-known/<file>` directly from the localised /de/ build
// output. Mounted as a dedicated `express.static` so the general static
// handler below can keep `serve-static`'s default `dotfiles: 'ignore'`
// behaviour — only files intentionally placed in `web/public/.well-known/`
// (and emitted by the Angular build into each locale bundle) become
// reachable. The mount path absorbs the `.well-known` segment, so the
// underlying lookup never sees a dot-prefixed URL component and no
// `dotfiles` opt-in is needed. `fallthrough: false` makes unknown files
// here 404 cleanly instead of leaking through to the Angular SSR engine
// (which would respond with the SPA shell — confusing for verifiers).
//
// `setHeaders` sets Cache-Control explicitly: the `maxAge` option alone
// produced `Cache-Control: no-cache` in production behind App Hosting
// (likely Cloud Run / Firebase edge-layer overriding `serve-static`'s
// default header). An explicit `res.setHeader` runs *before* the
// response is flushed, so it's authoritative on the origin side.
app.use(
  '/.well-known',
  express.static(join(browserDistFolder, 'de', '.well-known'), {
    index: false,
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    },
  })
);

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
 * Serve static files from /browser. Default `dotfiles: 'ignore'` is
 * intentional — anything that needs to live under a dot-prefixed path
 * (e.g. `/.well-known/...`) is opted in via a dedicated `express.static`
 * mount above, so accidental dotfiles in the build output stay hidden.
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
