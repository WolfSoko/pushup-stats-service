#!/usr/bin/env node
/**
 * Sets the { admin: true } custom claim on a Firebase Auth user.
 *
 * Usage:
 *   node scripts/set-admin-claim.mjs <email-or-uid> [--project <project-id>]
 *
 * Examples:
 *   node scripts/set-admin-claim.mjs wolframsokollek@gmail.com
 *   node scripts/set-admin-claim.mjs blq5ByiN0lXlWiT0mJMIQ4HSkbJ3
 *   node scripts/set-admin-claim.mjs wolframsokollek@gmail.com --project pushup-stats-staging-867b7
 *
 * Requires:
 *   - gcloud CLI authenticated, OR
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const args = process.argv.slice(2);
const projectFlag = args.indexOf('--project');
const projectId = projectFlag !== -1 ? args[projectFlag + 1] : undefined;
const target = args.find((a) => !a.startsWith('--') && a !== projectId);

if (!target) {
  console.error(
    'Usage: node scripts/set-admin-claim.mjs <email-or-uid> [--project <id>]'
  );
  process.exit(1);
}

const appOptions = projectId
  ? { projectId, credential: applicationDefault() }
  : { credential: applicationDefault() };
initializeApp(appOptions);
const auth = getAuth();

async function main() {
  // Determine if target is an email or UID
  const isEmail = target.includes('@');
  const user = isEmail
    ? await auth.getUserByEmail(target)
    : await auth.getUser(target);

  console.log(`Found user: ${user.displayName || user.email || user.uid}`);
  console.log(`  UID:    ${user.uid}`);
  console.log(`  Email:  ${user.email || '(none)'}`);
  console.log(`  Claims: ${JSON.stringify(user.customClaims || {})}`);

  await auth.setCustomUserClaims(user.uid, {
    ...user.customClaims,
    admin: true,
  });

  const updated = await auth.getUser(user.uid);
  console.log(
    `\n✓ Custom claims updated: ${JSON.stringify(updated.customClaims)}`
  );
  console.log(
    '\nNote: The user must sign out and back in (or wait ~1h) for the new claims to take effect.'
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
