import * as Sentry from '@sentry/node';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Side-effectful initialization. This module is the single owner of
// `Sentry.init` + `initializeApp()` and MUST be imported (directly or
// transitively) before any code that calls `getFirestore()`. Every trigger
// module imports `db` from here, which guarantees the init runs first because
// ES module evaluation resolves this module's top-level statements before the
// importing module's body.
Sentry.init({
  dsn: 'https://084cd4acd3e626148eba3a831d0e4bee@o1384048.ingest.us.sentry.io/4511089937219584',
  release: process.env['SENTRY_RELEASE'] || undefined,
  environment: process.env['SENTRY_ENVIRONMENT'] ?? 'production',
  tracesSampleRate: 0.1,
});

initializeApp();

export const db = getFirestore();
export const TZ = 'Europe/Berlin';
export const DEMO_USER_ID = '9CrETSHzoKcPPw0ctHKM1OiyRrp2';
