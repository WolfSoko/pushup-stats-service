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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
  const entriesRef = db.collection('exerciseEntries');
  // Firestore caps a batch at 500 writes; 90 days can hold up to 720.
  let batch = db.batch();
  let staged = 0;

  const now = new Date();
  let totalEntries = 0;

  for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
    const date = new Date(now);
    date.setDate(now.getDate() - daysAgo);

    const entriesPerDay = randomInt(3, 8);
    for (let i = 0; i < entriesPerDay; i++) {
      const timestamp = randomTimestamp(date);
      const nowIso = new Date().toISOString();
      batch.set(entriesRef.doc(), {
        userId: DEMO_USER_ID,
        exerciseId: 'pushup',
        timestamp,
        reps: randomInt(10, 50),
        source: 'seed',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      totalEntries++;
      if (++staged === 400) {
        await batch.commit();
        batch = db.batch();
        staged = 0;
      }
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
