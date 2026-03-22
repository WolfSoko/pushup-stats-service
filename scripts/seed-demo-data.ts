/**
 * Seed script: generates realistic pushup demo data for the last 90 days.
 *
 * Usage:
 *   DEMO_USER_ID=<uid> npx ts-node scripts/seed-demo-data.ts
 *
 * The DEMO_USER_ID env var must match the placeholder in:
 *   - web/src/env/demo.config.ts
 *   - data-store/firestore.rules
 */
import * as admin from 'firebase-admin';

const DEMO_USER_ID = process.env['DEMO_USER_ID'] ?? 'DEMO_USER_ID_PLACEHOLDER';

const PUSHUP_TYPES = ['Standard', 'Wide', 'Diamond', 'Pike'] as const;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

/** Returns an ISO timestamp (YYYY-MM-DDTHH:mm) between 07:00 and 21:00 on the given date. */
function randomTimestamp(date: Date): string {
  const y = date.getFullYear();
  const m = padTwo(date.getMonth() + 1);
  const d = padTwo(date.getDate());
  const hour = randomInt(7, 20);
  const minute = randomInt(0, 59);
  return `${y}-${m}-${d}T${padTwo(hour)}:${padTwo(minute)}`;
}

async function run(): Promise<void> {
  admin.initializeApp();
  const db = admin.firestore();
  const batch = db.batch();
  const pushupsRef = db.collection('pushups');

  const now = new Date();
  let totalEntries = 0;

  for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
    const date = new Date(now);
    date.setDate(now.getDate() - daysAgo);

    const entriesPerDay = randomInt(3, 8);
    for (let i = 0; i < entriesPerDay; i++) {
      const timestamp = randomTimestamp(date);
      const nowIso = new Date().toISOString();
      const docRef = pushupsRef.doc();
      batch.set(docRef, {
        userId: DEMO_USER_ID,
        timestamp,
        reps: randomInt(10, 50),
        type: randomItem(PUSHUP_TYPES),
        source: 'seed',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      totalEntries++;
    }
  }

  await batch.commit();
  console.log(
    `✓ Seeded ${totalEntries} pushup entries for demo user "${DEMO_USER_ID}"`
  );
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
