const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const {
  RecaptchaEnterpriseServiceClient,
} = require('@google-cloud/recaptcha-enterprise');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const TZ = 'Europe/Berlin';
const TOP_N = 10;
const DEMO_USER_ID = 'aqgzwSbhudRLrluz1zBSW3XQx013';

const recaptchaClient = new RecaptchaEnterpriseServiceClient();
const RECAPTCHA_PROJECT_ID = 'pushup-stats';
const RECAPTCHA_SITE_KEY = '6LdIVoEsAAAAAMk4rJwg2DYHfM7ud_as7V5rUf4g';
const RECAPTCHA_MIN_SCORE = 0.5;

function berlinDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function isoWeekFromYmd(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function toAnonymousLabel() {
  return 'anonym';
}

function toPublicDisplayName(profile) {
  const name = String(profile?.displayName || '').trim();
  if (!name) return toAnonymousLabel();
  return name;
}

function isLeaderboardNameAllowed(profile) {
  // Privacy-first default: only show usernames when explicit opt-in is set.
  return profile?.ui?.hideFromLeaderboard === false;
}

function rankEntries(rows, periodKey, targetKey, userProfiles) {
  const totals = new Map();
  for (const row of rows) {
    if (!row.timestamp || !row.userId) continue;
    const datePart = String(row.timestamp).slice(0, 10);
    const d = new Date(`${datePart}T00:00:00Z`);
    const p = berlinDateParts(d);
    let key;
    if (periodKey === 'daily') key = p.isoDate;
    else if (periodKey === 'monthly')
      key = `${p.year}-${String(p.month).padStart(2, '0')}`;
    else {
      const wk = isoWeekFromYmd(p.year, p.month, p.day);
      key = `${wk.year}-W${String(wk.week).padStart(2, '0')}`;
    }
    if (key !== targetKey) continue;
    totals.set(
      row.userId,
      (totals.get(row.userId) || 0) + Number(row.reps || 0)
    );
  }

  return [...totals.entries()]
    .map(([userId, reps]) => {
      const profile = userProfiles.get(userId);
      const alias = isLeaderboardNameAllowed(profile)
        ? toPublicDisplayName(profile)
        : toAnonymousLabel();
      return { alias, reps };
    })
    .sort((a, b) => b.reps - a.reps)
    .slice(0, TOP_N);
}

async function createRecaptchaAssessment({
  token,
  recaptchaAction,
  projectID = RECAPTCHA_PROJECT_ID,
  recaptchaKey = RECAPTCHA_SITE_KEY,
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

  if (!response.tokenProperties?.valid) {
    return {
      ok: false,
      score: 0,
      reason: `invalid-token:${response.tokenProperties?.invalidReason || 'unknown'}`,
      reasons: [],
      actionMatched: false,
      action: response.tokenProperties?.action || null,
    };
  }

  const actionMatched = response.tokenProperties?.action === recaptchaAction;
  const score = Number(response.riskAnalysis?.score || 0);
  const reasons = (response.riskAnalysis?.reasons || []).map(String);

  return {
    ok: actionMatched && score >= RECAPTCHA_MIN_SCORE,
    score,
    reasons,
    actionMatched,
    action: response.tokenProperties?.action || null,
  };
}

async function rebuildLeaderboardsCore() {
  const now = new Date();
  const today = berlinDateParts(now);
  const week = isoWeekFromYmd(today.year, today.month, today.day);
  const monthStart = `${today.year}-${String(today.month).padStart(2, '0')}-01`;

  const snap = await db
    .collection('pushups')
    .where('timestamp', '>=', monthStart)
    .orderBy('timestamp', 'desc')
    .get();

  const rows = snap.docs
    .map((d) => d.data())
    .filter((r) => r.userId !== DEMO_USER_ID);

  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))];
  const userProfiles = new Map();
  if (userIds.length > 0) {
    const cfgSnaps = await Promise.all(
      userIds.map((userId) => db.collection('userConfigs').doc(userId).get())
    );
    for (const cfg of cfgSnaps) {
      userProfiles.set(cfg.id, cfg.exists ? cfg.data() || {} : {});
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

exports.assessRecaptchaToken = onCall(
  {
    region: 'europe-west3',
  },
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

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
  const snap = await db.collection('userConfigs').doc(uid).get();
  if (!snap.exists || snap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Kein Admin-Zugriff.');
  }
}

// ─── adminListUsers ────────────────────────────────────────────────────────────

exports.adminListUsers = onCall({ region: 'europe-west3' }, async (request) => {
  await assertAdmin(request.auth?.uid);

  // Collect all Auth users (paginate through all pages)
  const authUsers = [];
  let pageToken;
  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    authUsers.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  // Fetch all userConfigs in batches of 10 (Firestore in-query limit)
  const uids = authUsers.map((u) => u.uid);
  const configMap = new Map();
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

  // Count pushups per user and get last pushup timestamp
  const pushupCountMap = new Map();
  const lastPushupMap = new Map();
  const pushupSnap = await db.collection('pushups').get();
  for (const doc of pushupSnap.docs) {
    const data = doc.data();
    if (!data.userId) continue;
    pushupCountMap.set(data.userId, (pushupCountMap.get(data.userId) || 0) + 1);
    const ts = data.timestamp;
    if (
      !lastPushupMap.has(data.userId) ||
      ts > lastPushupMap.get(data.userId)
    ) {
      lastPushupMap.set(data.userId, ts);
    }
  }

  return authUsers.map((user) => {
    const config = configMap.get(user.uid) || {};
    return {
      uid: user.uid,
      displayName: config.displayName || user.displayName || null,
      email: config.email || user.email || null,
      anonymous: user.providerData.length === 0,
      pushupCount: pushupCountMap.get(user.uid) || 0,
      lastEntry: lastPushupMap.get(user.uid) || null,
      createdAt: user.metadata.creationTime || null,
      role: config.role || null,
    };
  });
});

// ─── adminDeleteUser ───────────────────────────────────────────────────────────

exports.adminDeleteUser = onCall(
  { region: 'europe-west3' },
  async (request) => {
    await assertAdmin(request.auth?.uid);

    const uid = String(request.data?.uid || '').trim();
    const anonymize = Boolean(request.data?.anonymize ?? true);

    if (!uid) throw new HttpsError('invalid-argument', 'uid erforderlich.');
    if (uid === DEMO_USER_ID) {
      throw new HttpsError(
        'failed-precondition',
        'Demo-Benutzer kann nicht gelöscht werden.'
      );
    }

    // Delete Firebase Auth user
    await admin.auth().deleteUser(uid);

    if (anonymize) {
      // Keep pushups but anonymise the userConfig
      await db
        .collection('userConfigs')
        .doc(uid)
        .set(
          {
            displayName: 'Gelöschter Benutzer',
            email: null,
            role: admin.firestore.FieldValue.delete(),
            ui: { hideFromLeaderboard: true },
          },
          { merge: true }
        );
    } else {
      // Hard delete: remove userConfig + all pushups
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

    logger.info('adminDeleteUser', { uid, anonymize, by: request.auth?.uid });
    return { ok: true };
  }
);

// ─── adminBulkDeleteInactiveAnonymous ─────────────────────────────────────────

exports.adminBulkDeleteInactiveAnonymous = onCall(
  { region: 'europe-west3' },
  async (request) => {
    await assertAdmin(request.auth?.uid);

    const inactiveDays = Number(request.data?.inactiveDays ?? 20);
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // Collect anonymous Auth users
    const anonymousUsers = [];
    let pageToken;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      for (const user of result.users) {
        if (user.providerData.length === 0 && user.uid !== DEMO_USER_ID) {
          anonymousUsers.push(user.uid);
        }
      }
      pageToken = result.pageToken;
    } while (pageToken);

    // Find the last pushup timestamp per anonymous user
    const lastPushupMap = new Map();
    if (anonymousUsers.length > 0) {
      const pushupSnap = await db.collection('pushups').get();
      for (const doc of pushupSnap.docs) {
        const data = doc.data();
        if (!data.userId || !anonymousUsers.includes(data.userId)) continue;
        const ts = String(data.timestamp || '').slice(0, 10);
        if (
          !lastPushupMap.has(data.userId) ||
          ts > lastPushupMap.get(data.userId)
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

      // Delete Auth user
      await admin.auth().deleteUser(uid);

      // Delete userConfig
      await db.collection('userConfigs').doc(uid).delete();

      // Delete pushups
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

// ─── Leaderboard functions ────────────────────────────────────────────────────

exports.rebuildLeaderboards = onSchedule(
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

exports.refreshLeaderboardsOnPushupWrite = onDocumentWritten(
  {
    document: 'pushups/{pushupId}',
    region: 'europe-west3',
    retry: false,
  },
  async () => {
    await rebuildLeaderboardsCore();
  }
);
