import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Talking to the emulators as the backend does.
 *
 * Seeding through the Admin SDK rather than through the UI keeps a spec
 * about the one flow it is named after: the friends spec should fail
 * because accepting a request broke, not because registering did.
 *
 * The project id is the one in `web/src/env/fire.config.ts`, which is
 * what the browser sends — the emulators partition by project, so a
 * different id here would seed accounts the app never sees.
 */
export const PROJECT_ID = 'pushup-stats';
export const AUTH_EMULATOR_HOST = '127.0.0.1:9099';
export const FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
export const EMULATOR_HUB_URL = 'http://127.0.0.1:4400';

/** The Admin SDK reads these on `initializeApp`, so they are set first. */
process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= AUTH_EMULATOR_HOST;
process.env['FIRESTORE_EMULATOR_HOST'] ??= FIRESTORE_EMULATOR_HOST;
process.env['GCLOUD_PROJECT'] ??= PROJECT_ID;

function adminApp(): App {
  return getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
}

/**
 * Strong enough for `hasStrongPasswordPolicy`, so the same constant works
 * for a seeded account and for one typed into the registration form.
 */
export const E2E_PASSWORD = 'E2ePass!1234';

export interface E2eAccount {
  readonly uid: string;
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

let sequence = 0;

/**
 * A fresh identity per call. Specs share one emulator and never wipe it:
 * unique accounts are what keeps them from reading each other's
 * friendships, and it is also what lets a failed run be inspected
 * afterwards instead of being cleaned away.
 */
export function uniqueIdentity(prefix: string): {
  email: string;
  displayName: string;
} {
  sequence += 1;
  const tag = `${Date.now().toString(36)}${sequence}`;
  return {
    email: `${prefix}-${tag}@e2e.test`,
    displayName: `${prefix}-${tag}`,
  };
}

/**
 * Creates a signed-up account: the Auth record the login form
 * authenticates against, plus the `userConfigs` document registration
 * would have written.
 *
 * `dailyGoal` and `consent.acceptedAt` are part of that document on
 * purpose. An account missing them is one the app's own registration
 * never produces — it reads as "signed up but never finished
 * onboarding", and the app then greets it with something the specs are
 * not about.
 */
export async function createAccount(
  prefix: string,
  options: { publicProfile?: boolean } = {}
): Promise<E2eAccount> {
  const { email, displayName } = uniqueIdentity(prefix);
  const now = new Date().toISOString();
  const app = adminApp();
  const user = await getAuth(app).createUser({
    email,
    password: E2E_PASSWORD,
    displayName,
    emailVerified: true,
  });
  await getFirestore(app)
    .doc(`userConfigs/${user.uid}`)
    .set(
      {
        userId: user.uid,
        email,
        displayName,
        dailyGoal: 100,
        createdAt: now,
        consent: {
          dataProcessing: true,
          statistics: true,
          targetedAds: false,
          acceptedAt: now,
        },
        ui: { publicProfile: options.publicProfile ?? true },
      },
      { merge: true }
    );
  return { uid: user.uid, email, password: E2E_PASSWORD, displayName };
}

/** Whether the Auth emulator knows an address — proof a signup landed. */
export async function accountExists(email: string): Promise<boolean> {
  return getAuth(adminApp())
    .getUserByEmail(email)
    .then(() => true)
    .catch(() => false);
}

export async function readDoc(
  path: string
): Promise<Record<string, unknown> | undefined> {
  const snapshot = await getFirestore(adminApp()).doc(path).get();
  return snapshot.data();
}

/** Every entry a user logged, in whatever order Firestore hands them back. */
export async function readEntries(
  uid: string
): Promise<ReadonlyArray<Record<string, unknown>>> {
  const snapshot = await getFirestore(adminApp())
    .collection('exerciseEntries')
    .where('userId', '==', uid)
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Resolves once Auth, Firestore and Functions have all registered with
 * the emulator hub. Playwright's `webServer` only waits for the hub
 * itself, which answers before the Functions emulator has loaded the
 * callables every friends assertion goes through.
 */
export async function waitForEmulators(timeoutMs = 180_000): Promise<void> {
  const required = ['auth', 'firestore', 'functions'];
  const deadline = Date.now() + timeoutMs;
  let lastSeen: string[] = [];
  while (Date.now() < deadline) {
    lastSeen = await runningEmulators();
    if (required.every((name) => lastSeen.includes(name))) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(
    `Emulators not ready after ${timeoutMs}ms. Running: ${lastSeen.join(', ') || 'none'}`
  );
}

async function runningEmulators(): Promise<string[]> {
  try {
    const response = await fetch(`${EMULATOR_HUB_URL}/emulators`);
    if (!response.ok) return [];
    return Object.keys((await response.json()) as Record<string, unknown>);
  } catch {
    return [];
  }
}
