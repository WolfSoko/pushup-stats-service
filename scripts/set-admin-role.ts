/**
 * Sets the `admin` custom claim on Firebase Auth users.
 *
 * Usage:
 *   npx ts-node scripts/set-admin-role.ts
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Firebase Admin default credentials.
 */
import * as admin from 'firebase-admin';

const ADMIN_UIDS = [
  'sH2P1bJL1WPaJDr9oFQZBJrGN9v2',
  'blq5ByiN0lXlWiT0mJMIQ4HSkbJ3',
];

admin.initializeApp();

async function setAdminClaims(): Promise<void> {
  for (const uid of ADMIN_UIDS) {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`Custom claim { admin: true } set on user ${uid}`);
  }
}

setAdminClaims()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
