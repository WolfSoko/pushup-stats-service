// Script to import user configs from JSON to Firestore Emulator
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('node:fs');
const path = require('node:path');

// Use the Firebase Emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

initializeApp({
  projectId: 'pushup-stats-service-local',
  credential: applicationDefault(),
});

const db = getFirestore();
const configs = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../../data/user-config-export.json'),
    'utf8'
  )
);

(async () => {
  for (const config of configs) {
    const { userId, ...rest } = config;
    await db.collection('userConfigs').doc(userId).set(rest);
    console.log(`Imported config for user: ${userId}`);
  }
  console.log('Import complete.');
})();
