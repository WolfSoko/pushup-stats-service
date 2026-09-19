import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * The backend the run is pointed at.
 *
 * `emulator` is the default and what CI gates every PR on. `staging`
 * points the same specs at the deployed preview and the real staging
 * Firebase project — deployed rules, real callables, real indexes, which
 * is the part emulators cannot vouch for.
 */
export type E2eTarget = 'emulator' | 'staging';

export const TARGET: E2eTarget =
  process.env['E2E_TARGET'] === 'staging' ? 'staging' : 'emulator';

/**
 * The project the browser talks to, which the Admin SDK has to match —
 * both backends partition by project, so a mismatch here would seed
 * accounts the app never sees. The emulator id comes from
 * `web/src/env/fire.config.ts`, the staging one from
 * `fire.config.staging.ts`.
 */
export const PROJECT_ID =
  TARGET === 'staging' ? 'pushup-stats-staging-867b7' : 'pushup-stats';

export const EMULATOR_HUB_URL = 'http://127.0.0.1:4400';

/**
 * Against the emulators the Admin SDK is pointed at them by environment;
 * against staging it must NOT be, and authenticates with whatever
 * application-default credentials the runner holds (in CI the keyless
 * Workload Identity federation the staging deploy already sets up).
 */
if (TARGET === 'emulator') {
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= '127.0.0.1:9099';
  process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';
  process.env['GCLOUD_PROJECT'] ??= PROJECT_ID;
}

export function adminApp(): App {
  return getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
}

/**
 * Stamped into every address this run creates.
 *
 * Staging is shared — two pull requests can be running this suite at the
 * same time — so teardown has to be able to tell its own accounts from
 * somebody else's. In CI this is the GitHub run id.
 */
export const RUN_ID = (process.env['E2E_RUN_ID'] ?? `local${Date.now()}`)
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

/** The domain every account this suite creates lives on. Never routable. */
export const E2E_EMAIL_DOMAIN = 'e2e.test';

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
 * A fresh identity per call. Specs share one backend and never wipe it
 * mid-run: unique accounts are what keeps them from reading each other's
 * friendships, and on staging the run id is what makes them removable
 * afterwards.
 */
export function uniqueIdentity(prefix: string): {
  email: string;
  displayName: string;
} {
  sequence += 1;
  const tag = `${Date.now().toString(36)}${sequence}`;
  return {
    email: `e2e-${RUN_ID}-${prefix}-${tag}@${E2E_EMAIL_DOMAIN}`,
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

/** Whether Auth knows an address — proof a signup landed. */
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
