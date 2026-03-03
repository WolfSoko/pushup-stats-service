#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'pushup-stats';
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  path.join(
    process.env.HOME ?? '/home/wolf',
    '.firebase',
    'pushup-stats-firebase-adminsdk-fbsvc-e502979fa7.json'
  );
const pushupsPath =
  process.env.PUSHUPS_DB_PATH ?? path.join(root, 'data', 'pushups.db');
const userConfigPath =
  process.env.USER_CONFIG_DB_PATH ?? path.join(root, 'data', 'user-config.db');

function readNedb(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((x) => x && !x.$$indexCreated);
}

function normDate(value) {
  if (!value) return undefined;
  if (value.$$date) return new Date(value.$$date).toISOString();
  if (typeof value === 'string') return value;
  return undefined;
}

function inferPrimaryUserId(configs) {
  const explicit = process.env.MIGRATION_DEFAULT_USER_ID;
  if (explicit) return explicit;
  const candidate = configs.find(
    (c) =>
      typeof c.userId === 'string' &&
      c.userId.length >= 20 &&
      c.userId !== 'default' &&
      c.userId !== 'test'
  );
  return candidate?.userId ?? 'default';
}

async function resolveEmail(auth, userId, existingEmail) {
  if (existingEmail) return existingEmail;
  if (!userId || userId === 'default' || userId === 'test') return null;
  try {
    const user = await auth.getUser(userId);
    return user.email ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const credential = fs.existsSync(serviceAccountPath)
    ? cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')))
    : applicationDefault();

  initializeApp({ projectId, credential });

  const db = getFirestore();
  const auth = getAuth();

  const userConfigs = readNedb(userConfigPath);
  const pushups = readNedb(pushupsPath);
  const primaryUserId = inferPrimaryUserId(userConfigs);

  console.log(`Project: ${projectId}`);
  console.log(
    `Credential source: ${fs.existsSync(serviceAccountPath) ? serviceAccountPath : 'applicationDefault()'}`
  );
  console.log(`User configs: ${userConfigs.length}`);
  console.log(`Pushups: ${pushups.length}`);
  console.log(`Default pushup owner: ${primaryUserId}`);

  for (const config of userConfigs) {
    const userId = config.userId;
    if (!userId) continue;

    const email = await resolveEmail(auth, userId, config.email);

    await db
      .collection('userConfigs')
      .doc(userId)
      .set(
        {
          userId,
          email,
          displayName: config.displayName ?? null,
          dailyGoal: config.dailyGoal ?? null,
          ui: config.ui ?? {},
          createdAt: normDate(config.createdAt) ?? null,
          updatedAt: normDate(config.updatedAt) ?? null,
          migratedAt: new Date().toISOString(),
          migrationSource: 'nedb',
        },
        { merge: true }
      );
  }

  for (const row of pushups) {
    if (!row._id) continue;
    const userId = row.userId ?? primaryUserId;

    await db
      .collection('pushups')
      .doc(String(row._id))
      .set(
        {
          userId,
          timestamp: row.timestamp,
          reps: Number(row.reps),
          source: row.source ?? 'api',
          type: row.type ?? 'Standard',
          createdAt: normDate(row.createdAt) ?? null,
          updatedAt: normDate(row.updatedAt) ?? null,
          migratedAt: new Date().toISOString(),
          migrationSource: 'nedb',
        },
        { merge: true }
      );
  }

  console.log('Migration complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
