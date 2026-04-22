import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { UserStats } from '@pu-stats/models';
import { USERSTATS_VERSION } from '@pu-stats/models';
import * as Sentry from '@sentry/node';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import webpush from 'web-push';
import {
  buildGithubIssueBody,
  validateAdminAccess,
  validateFeedbackId,
  validateMarkFeedbackReadPayload,
} from './admin';
import { parseRecaptchaResponse } from './authentication';

// Module imports
import { berlinDateParts, isoWeekFromYmd } from './datetime';
import { getMonthStartForQuery, rankEntries } from './leaderboard';
import {
  FALLBACK_QUOTES_DE,
  FALLBACK_QUOTES_EN,
  QUOTE_CACHE_HOURS,
} from './motivation';
import { UserProfile } from './profile';
import type { ReminderConfig } from './push';
import {
  buildNotificationPayload,
  isLeaseStale,
  pushSubscriptionId,
  PUSH_SEND_OPTIONS,
  shouldSendReminder,
  STALE_LEASE_MS,
} from './push';
import { applyDelta, rebuildFromEntries } from './user-stats-delta';

Sentry.init({
  dsn: 'https://084cd4acd3e626148eba3a831d0e4bee@o1384048.ingest.us.sentry.io/4511089937219584',
  release: process.env['SENTRY_RELEASE'] || undefined,
  environment: process.env['SENTRY_ENVIRONMENT'] ?? 'production',
  tracesSampleRate: 0.1,
});

admin.initializeApp();

const db = admin.firestore();
const TZ = 'Europe/Berlin';
const DEMO_USER_ID = 'aqgzwSbhudRLrluz1zBSW3XQx013';
const GITHUB_TOKEN = defineSecret('GITHUB_TOKEN');

const recaptchaClient = new RecaptchaEnterpriseServiceClient();
const RECAPTCHA_PROJECT_ID = 'pushup-stats';
const RECAPTCHA_SITE_KEY = '6LdIVoEsAAAAAMk4rJwg2DYHfM7ud_as7V5rUf4g';
const RECAPTCHA_MIN_SCORE = 0.5;

async function createRecaptchaAssessment({
  token,
  recaptchaAction,
  projectID = RECAPTCHA_PROJECT_ID,
  recaptchaKey = RECAPTCHA_SITE_KEY,
}: {
  token: string;
  recaptchaAction: string;
  projectID?: string;
  recaptchaKey?: string;
}) {
  const projectPath = recaptchaClient.projectPath(projectID);

  const request = {
    assessment: {
      event: {
        token,
        siteKey: recaptchaKey,
      },
    },
    parent: projectPath,
  };

  const [response] = await recaptchaClient.createAssessment(request);
  return parseRecaptchaResponse(response, recaptchaAction, RECAPTCHA_MIN_SCORE);
}

async function rebuildLeaderboardsCore() {
  const now = new Date();
  const today = berlinDateParts(now);
  const week = isoWeekFromYmd(today.year, today.month, today.day);
  const monthStart = getMonthStartForQuery(today);

  const snap = await db
    .collection('pushups')
    .where('timestamp', '>=', monthStart)
    .orderBy('timestamp', 'desc')
    .get();

  const rows = snap.docs
    .map((d) => d.data())
    .filter((r) => r.userId !== DEMO_USER_ID);

  const userIds = [
    ...new Set(rows.map((r) => r.userId).filter(Boolean)),
  ] as string[];
  const userProfiles = new Map<string, UserProfile>();
  if (userIds.length > 0) {
    const cfgSnaps = await Promise.all(
      userIds.map((userId) => db.collection('userConfigs').doc(userId).get())
    );
    for (const cfg of cfgSnaps) {
      userProfiles.set(
        cfg.id,
        cfg.exists ? (cfg.data() as UserProfile) || {} : {}
      );
    }
  }

  const dailyKey = today.isoDate;
  const weeklyKey = `${week.year}-W${String(week.week).padStart(2, '0')}`;
  const monthlyKey = `${today.year}-${String(today.month).padStart(2, '0')}`;

  const daily = rankEntries(rows, 'daily', dailyKey, userProfiles);
  const weekly = rankEntries(rows, 'weekly', weeklyKey, userProfiles);
  const monthly = rankEntries(rows, 'monthly', monthlyKey, userProfiles);

  await db
    .collection('leaderboards')
    .doc('current')
    .set(
      {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        timezone: TZ,
        keys: { daily: dailyKey, weekly: weeklyKey, monthly: monthlyKey },
        periods: { daily, weekly, monthly },
      },
      { merge: true }
    );

  logger.info('Leaderboards rebuilt', {
    daily: daily.length,
    weekly: weekly.length,
    monthly: monthly.length,
  });
}

export const assessRecaptchaToken = onCall(
  { region: 'europe-west3' },
  async (request) => {
    const token = String(request.data?.token || '').trim();
    const recaptchaAction = String(request.data?.action || '').trim();

    if (!token || !recaptchaAction) {
      logger.warn('reCAPTCHA skipped due to missing token/action', {
        hasToken: Boolean(token),
        hasAction: Boolean(recaptchaAction),
        uid: request.auth?.uid || 'anonymous',
      });
      return {
        ok: false,
        skipped: true,
        score: 0,
        reasons: ['missing-token-or-action'],
        minScore: RECAPTCHA_MIN_SCORE,
      };
    }

    try {
      const assessment = await createRecaptchaAssessment({
        token,
        recaptchaAction,
      });

      const uid = request.auth?.uid || 'anonymous';
      logger.info('reCAPTCHA assessment completed', {
        uid,
        expectedAction: recaptchaAction,
        actualAction: assessment.action,
        actionMatched: assessment.actionMatched,
        ok: assessment.ok,
        score: assessment.score,
        minScore: RECAPTCHA_MIN_SCORE,
        reasons: assessment.reasons || [],
        invalidReason: assessment.reason || null,
      });

      if (!assessment.actionMatched) {
        logger.warn('reCAPTCHA action mismatch', {
          uid,
          expectedAction: recaptchaAction,
          actualAction: assessment.action,
        });
      }

      if (!assessment.ok) {
        logger.warn('reCAPTCHA blocked request', {
          uid,
          expectedAction: recaptchaAction,
          score: assessment.score,
          minScore: RECAPTCHA_MIN_SCORE,
          reasons: assessment.reasons || [],
          invalidReason: assessment.reason || null,
        });
      }

      return {
        ok: assessment.ok,
        score: assessment.score,
        reasons: assessment.reasons || [],
        minScore: RECAPTCHA_MIN_SCORE,
      };
    } catch (error) {
      logger.error('reCAPTCHA assessment failed', { error });
      throw new HttpsError('internal', 'reCAPTCHA Prüfung fehlgeschlagen.');
    }
  }
);

// ─── Admin helpers ────────────────────────────────────────────────────────────

function assertAdmin(request: {
  auth?: { uid: string; token: Record<string, unknown> };
}) {
  const error = validateAdminAccess(request.auth);
  if (error) throw new HttpsError(error.code, error.message);
}

// ─── adminListUsers ────────────────────────────────────────────────────────────

export const adminListUsers = onCall(
  { region: 'europe-west3', timeoutSeconds: 120 },
  async (request) => {
    assertAdmin(request);

    const authUsers: admin.auth.UserRecord[] = [];
    let pageToken: string | undefined;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      authUsers.push(...result.users);
      pageToken = result.pageToken;
    } while (pageToken);

    const uids = authUsers.map((u) => u.uid);
    const configMap = new Map<string, Record<string, unknown>>();
    for (let i = 0; i < uids.length; i += 10) {
      const batch = uids.slice(i, i + 10);
      const snaps = await db
        .collection('userConfigs')
        .where(admin.firestore.FieldPath.documentId(), 'in', batch)
        .get();
      for (const snap of snaps.docs) {
        configMap.set(snap.id, snap.data());
      }
    }

    const pushupCountMap = new Map<string, number>();
    const lastPushupMap = new Map<string, string>();
    const pushupSnap = await db.collection('pushups').get();
    for (const doc of pushupSnap.docs) {
      const data = doc.data();
      if (!data.userId) continue;
      pushupCountMap.set(
        data.userId,
        (pushupCountMap.get(data.userId) || 0) + 1
      );
      const ts = data.timestamp as string;
      if (
        !lastPushupMap.has(data.userId) ||
        ts > (lastPushupMap.get(data.userId) ?? '')
      ) {
        lastPushupMap.set(data.userId, ts);
      }
    }

    return authUsers.map((user) => {
      const config = configMap.get(user.uid) || {};
      return {
        uid: user.uid,
        displayName:
          (config as Record<string, unknown>).displayName ||
          user.displayName ||
          null,
        email: (config as Record<string, unknown>).email || user.email || null,
        anonymous: user.providerData.length === 0,
        pushupCount: pushupCountMap.get(user.uid) || 0,
        lastEntry: lastPushupMap.get(user.uid) || null,
        createdAt: user.metadata.creationTime || null,
        role: user.customClaims?.admin === true ? 'admin' : null,
      };
    });
  }
);

// ─── adminDeleteUser ───────────────────────────────────────────────────────────

export const adminDeleteUser = onCall(
  { region: 'europe-west3', timeoutSeconds: 120 },
  async (request) => {
    assertAdmin(request);

    const uid = String(request.data?.uid || '').trim();
    const anonymize = Boolean(request.data?.anonymize ?? true);

    if (!uid) throw new HttpsError('invalid-argument', 'uid erforderlich.');
    if (uid === DEMO_USER_ID) {
      throw new HttpsError(
        'failed-precondition',
        'Demo-Benutzer kann nicht gelöscht werden.'
      );
    }

    await admin.auth().deleteUser(uid);

    if (anonymize) {
      await db
        .collection('userConfigs')
        .doc(uid)
        .set(
          {
            displayName: 'Gelöschter Benutzer',
            email: null,
            ui: { hideFromLeaderboard: true },
          },
          { merge: true }
        );
    } else {
      await db.collection('userConfigs').doc(uid).delete();

      const pushupSnap = await db
        .collection('pushups')
        .where('userId', '==', uid)
        .get();

      const BATCH_SIZE = 500;
      for (let i = 0; i < pushupSnap.docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        for (const doc of pushupSnap.docs.slice(i, i + BATCH_SIZE)) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
    }

    await deleteAllPushSubscriptions(uid);

    logger.info('adminDeleteUser', { uid, anonymize, by: request.auth?.uid });
    return { ok: true };
  }
);

// ─── adminBulkDeleteInactiveAnonymous ─────────────────────────────────────────

export const adminBulkDeleteInactiveAnonymous = onCall(
  { region: 'europe-west3', timeoutSeconds: 300 },
  async (request) => {
    assertAdmin(request);

    const inactiveDays = Number(request.data?.inactiveDays ?? 20);
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const anonymousUsers: string[] = [];
    let pageToken: string | undefined;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      for (const user of result.users) {
        if (user.providerData.length === 0 && user.uid !== DEMO_USER_ID) {
          anonymousUsers.push(user.uid);
        }
      }
      pageToken = result.pageToken;
    } while (pageToken);

    const lastPushupMap = new Map<string, string>();
    if (anonymousUsers.length > 0) {
      const pushupSnap = await db.collection('pushups').get();
      for (const doc of pushupSnap.docs) {
        const data = doc.data();
        if (!data.userId || !anonymousUsers.includes(data.userId)) continue;
        const ts = String(data.timestamp || '').slice(0, 10);
        if (
          !lastPushupMap.has(data.userId) ||
          ts > (lastPushupMap.get(data.userId) ?? '')
        ) {
          lastPushupMap.set(data.userId, ts);
        }
      }
    }

    let deleted = 0;
    let skipped = 0;

    for (const uid of anonymousUsers) {
      const lastTs = lastPushupMap.get(uid);
      if (lastTs && lastTs >= cutoff) {
        skipped++;
        continue;
      }

      await admin.auth().deleteUser(uid);
      await db.collection('userConfigs').doc(uid).delete();

      const pushupSnap = await db
        .collection('pushups')
        .where('userId', '==', uid)
        .get();

      if (!pushupSnap.empty) {
        const batch = db.batch();
        for (const doc of pushupSnap.docs) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }

      await deleteAllPushSubscriptions(uid);
      deleted++;
    }

    logger.info('adminBulkDeleteInactiveAnonymous', {
      inactiveDays,
      cutoff,
      deleted,
      skipped,
      by: request.auth?.uid,
    });
    return { deleted, skipped };
  }
);

// ─── adminListFeedback ────────────────────────────────────────────────────────

export const adminListFeedback = onCall(
  { region: 'europe-west3', timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request);

    const snap = await db
      .collection('feedback')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name ?? null,
        email: d.email ?? null,
        message: d.message ?? '',
        userId: d.userId ?? null,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? null,
        userAgent: d.userAgent ?? null,
        read: d.read === true,
        githubIssueUrl: d.githubIssueUrl ?? null,
      };
    });
  }
);

// ─── adminMarkFeedbackRead ────────────────────────────────────────────────────

export const adminMarkFeedbackRead = onCall(
  { region: 'europe-west3' },
  async (request) => {
    assertAdmin(request);

    const validation = validateMarkFeedbackReadPayload(request.data);
    if (!validation.valid) {
      throw new HttpsError('invalid-argument', validation.error);
    }

    const feedbackRef = db.collection('feedback').doc(validation.feedbackId);
    const feedbackSnap = await feedbackRef.get();
    if (!feedbackSnap.exists) {
      throw new HttpsError('not-found', 'Feedback nicht gefunden.');
    }

    await feedbackRef.update({ read: validation.read });

    return { ok: true };
  }
);

// ─── adminDeleteFeedback ──────────────────────────────────────────────────────

export const adminDeleteFeedback = onCall(
  { region: 'europe-west3' },
  async (request) => {
    assertAdmin(request);

    const validation = validateFeedbackId(request.data);
    if (!validation.valid) {
      throw new HttpsError('invalid-argument', validation.error);
    }

    await db.collection('feedback').doc(validation.feedbackId).delete();

    return { ok: true };
  }
);

// ─── adminCreateGithubIssue ───────────────────────────────────────────────────

const GITHUB_REPO_OWNER = 'wolfsoko';
const GITHUB_REPO_NAME = 'pushup-stats-service';

export const adminCreateGithubIssue = onCall(
  { region: 'europe-west3', secrets: [GITHUB_TOKEN] },
  async (request) => {
    assertAdmin(request);

    const validation = validateFeedbackId(request.data);
    if (!validation.valid) {
      throw new HttpsError('invalid-argument', validation.error);
    }

    const token = GITHUB_TOKEN.value();
    if (!token || token.startsWith('placeholder')) {
      throw new HttpsError(
        'failed-precondition',
        'GITHUB_TOKEN secret ist nicht konfiguriert.'
      );
    }

    const docRef = db.collection('feedback').doc(validation.feedbackId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new HttpsError('not-found', 'Feedback nicht gefunden.');
    }

    const d = doc.data() ?? {};

    // Idempotency: return existing issue URL without creating a duplicate
    if (d.githubIssueUrl) {
      return { ok: true, issueUrl: d.githubIssueUrl as string };
    }

    const createdAt = d.createdAt?.toDate?.()?.toISOString?.() ?? null;
    const { title, body } = buildGithubIssueBody({
      name: (d.name as string) ?? null,
      message: (d.message as string) ?? '',
      createdAt,
      userId: (d.userId as string) ?? null,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ title, body, labels: ['feedback'] }),
          signal: controller.signal,
        }
      );
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new HttpsError('deadline-exceeded', 'GitHub API Timeout.');
      }
      throw err;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      logger.error('GitHub issue creation failed', {
        status: response.status,
        body: text,
      });
      throw new HttpsError(
        'internal',
        'GitHub-Issue konnte nicht erstellt werden.'
      );
    }

    const issueData = (await response.json()) as { html_url: string };
    const issueUrl = issueData.html_url;

    await docRef.update({ githubIssueUrl: issueUrl });

    return { ok: true, issueUrl };
  }
);

// ─── Leaderboard functions ────────────────────────────────────────────────────

export const rebuildLeaderboards = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: TZ,
    region: 'europe-west3',
    retryCount: 1,
  },
  async () => {
    await rebuildLeaderboardsCore();
  }
);

export const refreshLeaderboardsOnPushupWrite = onDocumentWritten(
  {
    document: 'pushups/{pushupId}',
    region: 'europe-west3',
    retry: false,
  },
  async () => {
    await rebuildLeaderboardsCore();
  }
);

// ─── generateMotivationQuotes ─────────────────────────────────────────────────

export const generateMotivationQuotes = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }

    const uid = request.auth.uid;
    const language = String(request.data?.language || 'de');
    const totalToday = Number(request.data?.totalToday ?? 0);
    const dailyGoal = Number(request.data?.dailyGoal ?? 100);
    const rawName = String(request.data?.displayName || '').trim();
    const displayName =
      rawName
        .replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF .,'!?-]/g, '')
        .slice(0, 50)
        .trim() || 'Champ';

    const cacheRef = db
      .collection('motivationQuotes')
      .doc(`${uid}__${language}`);
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) {
      const cached = cacheSnap.data() ?? {};
      const generatedAt = cached.generatedAt
        ? new Date(cached.generatedAt)
        : null;
      if (generatedAt) {
        const ageHours =
          (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
        if (ageHours < QUOTE_CACHE_HOURS) {
          const cachedQuotes = (
            (cached.quotes || []) as Array<{ text?: string }>
          ).map((q) => q.text || q);
          return { quotes: cachedQuotes };
        }
      }
    }

    let quotes: string[] =
      language === 'en' ? [...FALLBACK_QUOTES_EN] : [...FALLBACK_QUOTES_DE];

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-lite',
      });

      let prompt: string;
      if (language === 'en') {
        prompt =
          `Generate exactly 10 short motivating sentences (max 120 chars each) in English for {{name}} who already did ${totalToday} of ${dailyGoal} push-ups today. Use '{{name}}' as placeholder where fitting. Vary tone (sporty, funny, serious). Return only a JSON array: ["..."]`.replace(
            /\{\{name\}\}/g,
            displayName
          );
      } else {
        prompt =
          `Generiere genau 10 kurze motivierende Sätze (je max. 120 Zeichen) auf Deutsch für {{name}}, der heute schon ${totalToday} von ${dailyGoal} Liegestützen gemacht hat. Verwende '{{name}}' als Platzhalter wo passend. Variiere Ton (sportlich, humorvoll, ernst). Gib nur ein JSON-Array zurück: ["..."]`.replace(
            /\{\{name\}\}/g,
            displayName
          );
      }

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          quotes = parsed
            .map(String)
            .filter((q: string) => q.trim().length > 0);
        }
      }
    } catch (err) {
      logger.warn(
        'generateMotivationQuotes: Gemini call failed, using fallback',
        { err }
      );
    }

    const generatedAt = new Date().toISOString();
    await cacheRef.set({
      uid,
      quotes: quotes.map((text) => ({ text, lang: language })),
      generatedAt,
      totalToday,
      dailyGoal,
    });

    return { quotes };
  }
);

// ─── helpers ──────────────────────────────────────────────────────────────

async function deleteAllPushSubscriptions(uid: string) {
  const userRef = db.collection('pushSubscriptions').doc(uid);
  const subs = await userRef.collection('subs').listDocuments();
  const batch = db.batch();
  subs.forEach((doc) => batch.delete(doc));
  batch.delete(userRef);
  await batch.commit();
  logger.info('deleteAllPushSubscriptions: cleaned up', {
    uid,
    count: subs.length,
  });
}

// ─── savePushSubscription ──────────────────────────────────────────────────

export const savePushSubscription = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }

    const uid = request.auth.uid;
    const { endpoint, keys, userAgent, locale } = request.data ?? {};

    if (!endpoint || typeof endpoint !== 'string') {
      throw new HttpsError('invalid-argument', 'endpoint fehlt.');
    }
    if (!keys?.p256dh || !keys?.auth) {
      throw new HttpsError('invalid-argument', 'keys fehlen.');
    }

    const subId = pushSubscriptionId(endpoint);

    const now = new Date().toISOString();
    const ref = db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .doc(subId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      tx.set(
        ref,
        {
          endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          userAgent: userAgent || null,
          locale: locale || null,
          updatedAt: now,
          ...(snap.data()?.createdAt ? {} : { createdAt: now }),
        },
        { merge: true }
      );
    });

    const allSubs = await db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .count()
      .get();
    const deviceCount = allSubs.data().count;

    logger.info('savePushSubscription: saved', { uid, subId, deviceCount });
    return { ok: true, subId, deviceCount };
  }
);

// ─── deletePushSubscription ────────────────────────────────────────────────

export const deletePushSubscription = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }

    const uid = request.auth.uid;
    const { endpoint } = request.data ?? {};

    if (!endpoint || typeof endpoint !== 'string') {
      throw new HttpsError('invalid-argument', 'endpoint fehlt.');
    }

    const subId = pushSubscriptionId(endpoint);

    await db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .doc(subId)
      .delete();

    const remainingSubs = await db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .count()
      .get();
    const deviceCount = remainingSubs.data().count;

    logger.info('deletePushSubscription: removed', { uid, subId, deviceCount });
    return { ok: true, deviceCount };
  }
);

// ─── unsubscribeAllPushDevices ────────────────────────────────────────────
// Removes every push subscription registered against the caller's UID (across
// all devices). The caller stays signed in — this only wipes push records so
// no further Web Push notifications are delivered to any device.

export const unsubscribeAllPushDevices = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }
    const uid = request.auth.uid;

    await deleteAllPushSubscriptions(uid);

    logger.info('unsubscribeAllPushDevices: cleaned up', { uid });
    return { ok: true };
  }
);

// ─── Web Push Reminder Dispatch ───────────────────────────────────────────────

const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = defineSecret('VAPID_PUBLIC_KEY');

export const dispatchPushReminders = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: TZ,
    region: 'europe-west3',
    secrets: [VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY],
  },
  async () => {
    const vapidPrivate = VAPID_PRIVATE_KEY.value().trim();
    const vapidPublic = VAPID_PUBLIC_KEY.value().trim();

    if (!vapidPrivate || !vapidPublic) {
      logger.warn('dispatchPushReminders: VAPID secrets not set, skipping');
      return;
    }

    webpush.setVapidDetails(
      'mailto:einstein-openclaw@gmail.com',
      vapidPublic,
      vapidPrivate
    );

    const nowMs = Date.now();

    const subsSnap = await db.collection('pushSubscriptions').listDocuments();
    logger.info('dispatchPushReminders: checking users', {
      count: subsSnap.length,
    });

    const results = { sent: 0, skipped: 0, errors: 0, expired: 0 };

    for (const userRef of subsSnap) {
      const uid = userRef.id;

      try {
        const userConfigSnap = await db
          .collection('userConfigs')
          .doc(uid)
          .get();
        const reminder = userConfigSnap.data()?.reminder as
          | ReminderConfig
          | undefined;

        const dispatchRef = db.collection('reminderDispatchState').doc(uid);
        let leaseAcquired = false;

        await db.runTransaction(async (tx) => {
          const dispatchSnap = await tx.get(dispatchRef);
          const lastSentAt = dispatchSnap.data()?.lastSentAt || null;
          const snoozedUntil = dispatchSnap.data()?.snoozedUntil || null;
          const alreadyInProgress = dispatchSnap.data()?.inProgress === true;

          if (alreadyInProgress) {
            const leaseAcquiredAt =
              dispatchSnap.data()?.leaseAcquiredAt ?? null;
            if (!isLeaseStale(leaseAcquiredAt, nowMs)) {
              return; // Lease is fresh — another invocation is actively sending
            }
            logger.warn(
              'dispatchPushReminders: stale lease detected, resetting',
              {
                uid,
                staleLimitMinutes: STALE_LEASE_MS / 60_000,
              }
            );
            // Clear the stale lease so it doesn't repeat the warning every tick
            // even when shouldSendReminder returns false (quiet hours, etc.)
            tx.set(
              dispatchRef,
              {
                inProgress: false,
                leaseAcquiredAt: admin.firestore.FieldValue.delete(),
              },
              { merge: true }
            );
          }
          if (!shouldSendReminder(reminder, lastSentAt, nowMs, snoozedUntil))
            return;

          tx.set(
            dispatchRef,
            {
              uid,
              inProgress: true,
              leaseAcquiredAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          leaseAcquired = true;
        });

        if (!leaseAcquired) {
          results.skipped++;
          continue;
        }

        let sentToUser = false;
        try {
          const subsCol = await userRef.collection('subs').get();
          if (subsCol.empty) {
            results.skipped++;
            continue;
          }

          const body = buildNotificationPayload(reminder?.language);
          const lang = reminder?.language === 'en' ? 'en' : 'de';
          const actions =
            lang === 'en'
              ? [
                  { action: 'snooze', title: '⏰ Snooze 30 min' },
                  { action: 'log', title: '✅ Log push-ups' },
                ]
              : [
                  { action: 'snooze', title: '⏰ 30 Min snoozen' },
                  { action: 'log', title: '✅ Eintragen' },
                ];
          const payload = JSON.stringify({
            title: 'PushUp Stats',
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            tag: 'reminder',
            renotify: true,
            data: { url: `/${lang}/app`, locale: lang },
            actions,
          });

          const expiredSubs: FirebaseFirestore.DocumentReference[] = [];

          for (const subDoc of subsCol.docs) {
            const { endpoint, keys } = subDoc.data();
            if (!endpoint || !keys?.p256dh || !keys?.auth) continue;

            const pushSub = {
              endpoint,
              keys: { p256dh: keys.p256dh, auth: keys.auth },
            };

            try {
              await webpush.sendNotification(
                pushSub,
                payload,
                PUSH_SEND_OPTIONS
              );
              sentToUser = true;
            } catch (err: unknown) {
              const pushErr = err as { statusCode?: number };
              if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                expiredSubs.push(subDoc.ref);
                results.expired++;
              } else {
                logger.warn('dispatchPushReminders: send failed', {
                  uid,
                  endpoint: endpoint.slice(-20),
                  status: pushErr.statusCode,
                });
                results.errors++;
              }
            }
          }

          if (expiredSubs.length > 0) {
            const batch = db.batch();
            expiredSubs.forEach((ref) => batch.delete(ref));
            await batch.commit();
          }

          if (sentToUser) {
            results.sent++;
          }
        } finally {
          // Release lease and update lastSentAt atomically so a failed
          // lastSentAt write can't leave the lease open for duplicate sends.
          const releaseData: Record<string, unknown> = {
            inProgress: false,
            leaseAcquiredAt: admin.firestore.FieldValue.delete(),
          };
          if (sentToUser) {
            releaseData['lastSentAt'] =
              admin.firestore.FieldValue.serverTimestamp();
          }
          await dispatchRef
            .set(releaseData, { merge: true })
            .catch((e: Error) =>
              logger.warn('dispatchPushReminders: failed to release lease', {
                uid,
                err: e.message,
              })
            );
        }
      } catch (err: unknown) {
        const error = err as Error;
        logger.error('dispatchPushReminders: error for user', {
          uid,
          err: error.message,
        });
        results.errors++;
      }
    }

    logger.info('dispatchPushReminders: done', results);
  }
);

// ─── snoozeReminder ────────────────────────────────────────────────────────

export const snoozeReminder = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', 'Auth required.');

    const uid = request.auth.uid;
    const snoozeMinutes = request.data?.snoozeMinutes ?? 30;

    if (
      typeof snoozeMinutes !== 'number' ||
      snoozeMinutes < 1 ||
      snoozeMinutes > 1440
    ) {
      throw new HttpsError('invalid-argument', 'snoozeMinutes must be 1–1440.');
    }

    const snoozeMs = snoozeMinutes * 60 * 1000;
    const snoozeUntil = admin.firestore.Timestamp.fromMillis(
      Date.now() + snoozeMs
    );

    const dispatchRef = db.collection('reminderDispatchState').doc(uid);
    await dispatchRef.set(
      {
        snoozedUntil: snoozeUntil,
        uid,
        snoozedAt: admin.firestore.FieldValue.serverTimestamp(),
        snoozeMinutes,
        inProgress: false,
      },
      { merge: true }
    );

    logger.info('snoozeReminder', { uid, snoozeMinutes });
    return { ok: true, snoozeUntil: snoozeUntil.toDate().toISOString() };
  }
);

// ─── updateUserStatsOnPushupWrite ─────────────────────────────────────────────
// Delta-based user statistics: atomically updates userStats/{userId} on every
// pushup create/update/delete.

export const updateUserStatsOnPushupWrite = onDocumentWritten(
  {
    document: 'pushups/{pushupId}',
    region: 'europe-west3',
  },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    const userId = (afterData?.userId ?? beforeData?.userId) as
      | string
      | undefined;
    if (!userId) {
      logger.warn('updateUserStatsOnPushupWrite: no userId found, skipping');
      return;
    }

    const oldReps = (beforeData?.reps ?? 0) as number;
    const newReps = (afterData?.reps ?? 0) as number;
    const oldTimestamp = beforeData?.timestamp as string | undefined;
    const newTimestamp = afterData?.timestamp as string | undefined;
    const oldSets = Array.isArray(beforeData?.sets)
      ? (beforeData.sets as number[])
      : [];
    const newSets = Array.isArray(afterData?.sets)
      ? (afterData.sets as number[])
      : [];

    const isCreate = !beforeData && !!afterData;
    const isDelete = !!beforeData && !afterData;
    const isUpdate = !!beforeData && !!afterData;
    const timestampChanged =
      isUpdate && oldTimestamp && newTimestamp && oldTimestamp !== newTimestamp;

    if (!newTimestamp && !oldTimestamp) {
      logger.warn('updateUserStatsOnPushupWrite: no timestamp found, skipping');
      return;
    }

    const nowIso = new Date().toISOString();
    const statsRef = db.collection('userStats').doc(userId);

    // IMPORTANT: Check if this is the first entry (no userStats yet)
    // OR if version is outdated (calculation logic changed)
    // If so, we'll do a full rebuild to ensure correct initialization
    let firstEntryAllEntries: Array<{
      timestamp: string;
      reps: number;
      sets?: number[];
    }> | null = null;
    let versionOutdated = false;

    const statsSnap = await statsRef.get();
    const existingStats = statsSnap.exists
      ? (statsSnap.data() as UserStats)
      : null;

    // Check version: if stored version < current version, trigger rebuild
    if (
      existingStats &&
      (!existingStats.version || existingStats.version < USERSTATS_VERSION)
    ) {
      versionOutdated = true;
      logger.info('updateUserStatsOnPushupWrite: version upgrade detected', {
        userId,
        oldVersion: existingStats.version ?? 1,
        newVersion: USERSTATS_VERSION,
      });
    }

    // Collect entries for rebuild if needed
    if ((isCreate && !existingStats) || versionOutdated) {
      const allEntriesSnap = await db
        .collection('pushups')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'asc')
        .get();

      firstEntryAllEntries = allEntriesSnap.docs.map((d) => {
        const data = d.data();
        return {
          timestamp: data.timestamp as string,
          reps: Number(data.reps ?? 0),
          ...(Array.isArray(data.sets) ? { sets: data.sets as number[] } : {}),
        };
      });
    }

    await db.runTransaction(async (tx) => {
      const statsSnap = await tx.get(statsRef);
      let current = statsSnap.exists ? (statsSnap.data() as UserStats) : null;

      // BUG FIX P1: Re-check version in transaction to avoid double-counting
      // The snapshot outside transaction may be stale; transaction sees latest state
      let shouldRebuild = false;
      if (firstEntryAllEntries !== null && isCreate && !current) {
        // First entry case: confirmed by transaction read
        shouldRebuild = true;
      } else if (
        firstEntryAllEntries !== null &&
        current &&
        (!current.version || current.version < USERSTATS_VERSION)
      ) {
        // Version upgrade case: confirmed by transaction read
        shouldRebuild = true;
      }

      if (shouldRebuild) {
        // Full rebuild: ensures atomicity and prevents double-counting from concurrent triggers
        current = rebuildFromEntries(userId, firstEntryAllEntries!, nowIso);
        const reason =
          isCreate && !statsSnap.exists ? 'first entry' : 'version upgrade';
        logger.info(
          'updateUserStatsOnPushupWrite: full rebuild (transaction-confirmed)',
          {
            userId,
            reason,
            entries: firstEntryAllEntries!.length,
            newVersion: USERSTATS_VERSION,
          }
        );
      } else if (current) {
        // Existing userStats with current version: use delta for efficiency
        if (timestampChanged) {
          // Timestamp changed: undo old entry, then apply new entry
          current = applyDelta(current, {
            userId,
            repsDelta: -oldReps,
            entriesDelta: -1,
            timestamp: oldTimestamp,
            newReps: 0,
            nowIso,
            setsDelta: -(oldSets.length || 0),
            oldSets: oldSets.length ? oldSets : undefined,
          });
          current = applyDelta(current, {
            userId,
            repsDelta: newReps,
            entriesDelta: 1,
            timestamp: newTimestamp,
            newReps,
            nowIso,
            setsDelta: newSets.length || 0,
            newSets: newSets.length ? newSets : undefined,
          });
        } else {
          const repsDelta = newReps - oldReps;
          const entriesDelta = isCreate ? 1 : isDelete ? -1 : 0;
          const timestamp = (newTimestamp ?? oldTimestamp)!;
          const setsDelta = (newSets.length || 0) - (oldSets.length || 0);

          current = applyDelta(current, {
            userId,
            repsDelta,
            entriesDelta,
            timestamp,
            newReps,
            nowIso,
            setsDelta,
            newSets: newSets.length ? newSets : undefined,
            oldSets: oldSets.length ? oldSets : undefined,
          });
        }
      } else {
        // Missing userStats on a non-first-create write: rebuild from source of truth
        // Writing empty stats here would permanently wipe totals for update/delete events
        const userPushupsQuery = db
          .collection('pushups')
          .where('userId', '==', userId);
        const userPushupsSnap = await tx.get(userPushupsQuery);
        const userEntries = userPushupsSnap.docs.map((doc) =>
          doc.data()
        ) as Parameters<typeof rebuildFromEntries>[1];

        logger.warn(
          'updateUserStatsOnPushupWrite: missing userStats, rebuilding from entries',
          {
            userId,
            isCreate,
            entries: userEntries.length,
          }
        );
        current = rebuildFromEntries(userId, userEntries, nowIso);
      }

      tx.set(statsRef, current);
    });

    logger.info('updateUserStatsOnPushupWrite', {
      userId,
      oldReps,
      newReps,
      timestampChanged,
      pushupId: event.params?.pushupId,
    });
  }
);

// ─── rebuildUserStats ─────────────────────────────────────────────────────────
// Admin-callable backfill: recomputes userStats/{userId} from all pushup entries.
// Accepts { userId?: string }. If userId is omitted, rebuilds for ALL users.

export const rebuildUserStats = onCall(
  { region: 'europe-west3', timeoutSeconds: 540 },
  async (request) => {
    assertAdmin(request);

    const targetUserId = request.data?.userId
      ? String(request.data.userId).trim()
      : null;
    const nowIso = new Date().toISOString();

    async function rebuildForUser(userId: string) {
      const snap = await db
        .collection('pushups')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'asc')
        .get();

      const entries = snap.docs.map((d) => {
        const data = d.data();
        return {
          timestamp: data.timestamp as string,
          reps: Number(data.reps ?? 0),
          ...(Array.isArray(data.sets) ? { sets: data.sets as number[] } : {}),
        };
      });

      const stats = rebuildFromEntries(userId, entries, nowIso);
      await db.collection('userStats').doc(userId).set(stats);
      return entries.length;
    }

    if (targetUserId) {
      const count = await rebuildForUser(targetUserId);
      logger.info('rebuildUserStats: single user', {
        userId: targetUserId,
        entries: count,
        by: request.auth?.uid,
      });
      return { rebuilt: 1, entries: count };
    }

    // Rebuild for ALL users
    const allPushups = await db.collection('pushups').get();
    const userIds = new Set<string>();
    for (const doc of allPushups.docs) {
      const uid = doc.data().userId;
      if (uid) userIds.add(uid);
    }

    let totalRebuilt = 0;
    for (const userId of userIds) {
      await rebuildForUser(userId);
      totalRebuilt++;
    }

    logger.info('rebuildUserStats: all users', {
      rebuilt: totalRebuilt,
      by: request.auth?.uid,
    });
    return { rebuilt: totalRebuilt };
  }
);
