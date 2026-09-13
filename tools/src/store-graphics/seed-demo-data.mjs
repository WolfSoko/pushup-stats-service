/**
 * Seeds the local Firebase emulator with the demo account the store
 * screenshots are taken from.
 *
 * Only raw entries are written — `userStats`, the leaderboards and the
 * challenge progress are left to the real Cloud Functions triggers, so the
 * numbers in the screenshots are the ones the product actually computes.
 * Hand-written aggregates would drift from the app the moment the
 * aggregation changes.
 *
 * Prerequisites: `nx run data-store:serve` (needs a JRE for the Firestore
 * emulator). See docs/play-store-publishing.md.
 */
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

const { initializeApp } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');

initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'pushup-stats' });
const db = getFirestore();
const auth = getAuth();

export const DEMO_PASSWORD = 'demo-screenshots-2026';
export const DEMO_EMAIL = 'wolf@demo.local';

const HERO = { uid: 'demo-hero', email: DEMO_EMAIL, name: 'Wolf' };
const FRIENDS = [
  { uid: 'demo-mara', name: 'Mara', daily: 70 },
  { uid: 'demo-jonas', name: 'Jonas', daily: 52 },
  { uid: 'demo-lena', name: 'Lena', daily: 44 },
  { uid: 'demo-tim', name: 'Tim', daily: 33 },
];
const PENDING = { uid: 'demo-nina', name: 'Nina' };
/** Fill the global board so it reads as a populated product, not an empty one. */
const CROWD = [
  { uid: 'demo-sven', name: 'Sven', daily: 62 },
  { uid: 'demo-ida', name: 'Ida', daily: 58 },
  { uid: 'demo-paul', name: 'Paul', daily: 51 },
  { uid: 'demo-nora', name: 'Nora', daily: 47 },
  { uid: 'demo-luis', name: 'Luis', daily: 41 },
  { uid: 'demo-ben', name: 'Ben', daily: 36 },
  { uid: 'demo-ella', name: 'Ella', daily: 30 },
  { uid: 'demo-kaya', name: 'Kaya', daily: 24 },
];

const PROFILE_SECTIONS = [
  'total',
  'streak',
  'days',
  'entries',
  'week',
  'month',
  'bestSet',
  'bestDay',
  'achievements',
  'exercises',
  'heatmap',
  'recent',
  'plan',
];
const allPublic = Object.fromEntries(
  PROFILE_SECTIONS.map((s) => [s, 'public'])
);
/** A mix of levels — a profile that is public everywhere shows nothing about the feature. */
const heroVisibility = {
  ...allPublic,
  entries: 'friends',
  month: 'friends',
  bestSet: 'friends',
  recent: 'friends',
};

const at = (daysBack, hour, minute) => {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const iso = (daysBack, hour, minute) =>
  at(daysBack, hour, minute).toISOString();

async function createUser({ uid, name, email }) {
  try {
    await auth.deleteUser(uid);
  } catch {
    /* first run */
  }
  await auth.createUser({
    uid,
    email: email ?? `${name.toLowerCase()}@demo.local`,
    password: DEMO_PASSWORD,
    displayName: name,
  });
}

async function wipe(collection) {
  const snap = await db.collection(collection).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

function heroEntries() {
  const out = [];
  for (let back = 69; back >= 0; back--) {
    const weekday = at(back, 12, 0).getDay();
    const restDay = weekday === 0 || (weekday === 3 && back % 14 > 6);
    if (restDay && back > 11) continue; // keep the last 12 days a streak
    const reps = Math.max(
      30,
      Math.round(55 * (1 + (69 - back) / 120)) + (((back * 37) % 17) - 8)
    );
    const sets = reps > 80 ? 3 : 2;
    for (let s = 0; s < sets; s++) {
      out.push({
        userId: HERO.uid,
        exerciseId: 'pushup',
        timestamp: iso(back, 18, 30 + s * 7),
        reps: Math.round(reps / sets),
      });
    }
    if (back % 3 === 0)
      out.push({
        userId: HERO.uid,
        exerciseId: 'legs.squats',
        timestamp: iso(back, 19, 5),
        reps: 40 + (back % 20),
      });
    if (back % 4 === 0)
      out.push({
        userId: HERO.uid,
        exerciseId: 'plank.standard',
        timestamp: iso(back, 19, 12),
        durationSec: 60 + (back % 30),
      });
    if (back % 5 === 0)
      out.push({
        userId: HERO.uid,
        exerciseId: 'pull.pullups',
        timestamp: iso(back, 19, 20),
        reps: 6 + (back % 5),
      });
    if (back % 7 === 0)
      out.push({
        userId: HERO.uid,
        exerciseId: 'cardio.running',
        timestamp: iso(back, 7, 15),
        distanceM: 5000 + (back % 3) * 1200,
        durationSec: 1680 + (back % 3) * 400,
      });
  }
  return out;
}

function otherEntries(uid, daily, days) {
  const out = [];
  for (let back = days; back >= 0; back--) {
    if (back % 4 === 3) continue;
    out.push({
      userId: uid,
      exerciseId: 'pushup',
      timestamp: iso(back, 17, 45),
      reps: Math.max(20, daily + (((back * 23) % 15) - 7)),
    });
  }
  return out;
}

const everyone = [HERO, ...FRIENDS, PENDING, ...CROWD];
console.log('users …');
for (const u of everyone) await createUser(u);

console.log('wipe …');
for (const c of [
  'exerciseEntries',
  'userConfigs',
  'friendships',
  'userTrainingPlans',
  'challenges',
  'leaderboards',
])
  await wipe(c);

console.log('configs …');
for (const u of everyone) {
  await db
    .collection('userConfigs')
    .doc(u.uid)
    .set({
      displayName: u.name,
      // Only public profiles appear on the global board (isPublicProfileLinkAllowed).
      ui: {
        profileVisibility: u.uid === HERO.uid ? heroVisibility : allPublic,
        hideFromLeaderboard: false,
      },
      consent: { targetedAds: false },
    });
}
await db
  .collection('userConfigs')
  .doc(HERO.uid)
  .set(
    {
      goals: {
        daily: [
          {
            id: 'g-d1',
            exerciseId: 'pushup',
            target: 150,
            measurement: 'reps',
            unit: 'reps',
          },
          {
            id: 'g-d2',
            exerciseId: 'legs.squats',
            target: 60,
            measurement: 'reps',
            unit: 'reps',
          },
        ],
        weekly: [
          {
            id: 'g-w1',
            exerciseId: 'pushup',
            target: 900,
            measurement: 'reps',
            unit: 'reps',
          },
        ],
        monthly: [
          {
            id: 'g-m1',
            exerciseId: 'pushup',
            target: 3600,
            measurement: 'reps',
            unit: 'reps',
          },
        ],
      },
      dailyGoal: 150,
      weeklyGoal: 900,
      monthlyGoal: 3600,
    },
    { merge: true }
  );

console.log('entries …');
const entries = [
  ...heroEntries(),
  ...FRIENDS.flatMap((f) => otherEntries(f.uid, f.daily, 40)),
  ...CROWD.flatMap((c) => otherEntries(c.uid, c.daily, 30)),
];
let batch = db.batch();
let n = 0;
for (const e of entries) {
  batch.set(db.collection('exerciseEntries').doc(), e);
  if (++n % 400 === 0) {
    await batch.commit();
    batch = db.batch();
  }
}
await batch.commit();
console.log(`  ${entries.length} entries`);

console.log('friendships …');
const pairId = (a, b) => [a, b].sort().join('__');
for (const f of FRIENDS) {
  await db
    .collection('friendships')
    .doc(pairId(HERO.uid, f.uid))
    .set({
      users: [HERO.uid, f.uid].sort(),
      requestedBy: HERO.uid,
      status: 'accepted',
      createdAt: iso(30, 9, 0),
      respondedAt: iso(29, 9, 0),
    });
}
await db
  .collection('friendships')
  .doc(pairId(HERO.uid, PENDING.uid))
  .set({
    users: [HERO.uid, PENDING.uid].sort(),
    requestedBy: PENDING.uid,
    status: 'pending',
    createdAt: iso(1, 9, 0),
  });

console.log('plan …');
const startBack = 11;
const dayStart = new Date();
dayStart.setHours(0, 0, 0, 0);
await db
  .collection('userTrainingPlans')
  .doc(HERO.uid)
  .set({
    userId: HERO.uid,
    planId: 'challenge-30d-v1', // catalog id, not the slug
    startDate: at(startBack, 12, 0).toISOString().slice(0, 10),
    status: 'active',
    completedDays: Array.from({ length: startBack }, (_, i) => i + 1),
    skippedDays: [],
    testResults: ['1:34'], // opening test scales every later day
    dayActivatedAt: dayStart.toISOString(), // today's entries count toward today's plan day
    createdAt: iso(startBack, 9, 0),
    updatedAt: new Date().toISOString(),
  });

console.log('challenge …');
await db
  .collection('challenges')
  .doc('demo-challenge')
  .set({
    createdBy: HERO.uid,
    participants: [HERO.uid, FRIENDS[0].uid, FRIENDS[1].uid],
    invited: [],
    exerciseId: 'pushup',
    target: 500,
    from: at(3, 12, 0).toISOString().slice(0, 10),
    to: at(-3, 12, 0).toISOString().slice(0, 10),
    createdAt: iso(3, 9, 0),
  });

console.log(`done — login ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
process.exit(0);
