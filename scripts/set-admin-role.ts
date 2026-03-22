/**
 * Sets role: 'admin' on the admin user's userConfig document in Firestore.
 *
 * Usage:
 *   npx ts-node scripts/set-admin-role.ts
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Firebase Admin default credentials.
 */
import * as admin from 'firebase-admin';

const ADMIN_UID = 'sH2P1bJL1WPaJDr9oFQZBJrGN9v2';

admin.initializeApp();

const db = admin.firestore();

async function setAdminRole(): Promise<void> {
  const ref = db.collection('userConfigs').doc(ADMIN_UID);
  await ref.set({ role: 'admin' }, { merge: true });
  console.log(`role: 'admin' set on userConfigs/${ADMIN_UID}`);
}

setAdminRole()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
