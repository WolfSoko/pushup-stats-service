const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const TZ = 'Europe/Berlin';
const TOP_N = 10;

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

function toAlias(userId) {
  const clean = (userId || '').trim();
  if (!clean) return 'A...X';
  const first = clean[0].toUpperCase();
  const last = clean[clean.length - 1].toUpperCase();
  return `${first}...${last}`;
}

function rankEntries(rows, periodKey, targetKey) {
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
    .map(([userId, reps]) => ({ alias: toAlias(userId), reps }))
    .sort((a, b) => b.reps - a.reps)
    .slice(0, TOP_N);
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

  const rows = snap.docs.map((d) => d.data());

  const dailyKey = today.isoDate;
  const weeklyKey = `${week.year}-W${String(week.week).padStart(2, '0')}`;
  const monthlyKey = `${today.year}-${String(today.month).padStart(2, '0')}`;

  const daily = rankEntries(rows, 'daily', dailyKey);
  const weekly = rankEntries(rows, 'weekly', weeklyKey);
  const monthly = rankEntries(rows, 'monthly', monthlyKey);

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
