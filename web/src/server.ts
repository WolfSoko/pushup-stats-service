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

if (process.env['NODE_ENV'] === 'production') {
  Sentry.init({
    dsn: 'https://084cd4acd3e626148eba3a831d0e4bee@o1384048.ingest.us.sentry.io/4511089937219584',
    sendDefaultPii: true,
    tracesSampleRate: 0.1,
    environment: 'production',
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

app.get('/ads.txt', (req, res) => {
  res.sendFile(join(browserDistFolder, 'de', 'ads.txt'));
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

// Sentry error handler must be after routes
if (process.env['NODE_ENV'] === 'production') {
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
