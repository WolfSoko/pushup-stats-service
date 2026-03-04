// Script to import user configs from JSON to Firestore Emulator
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Reads user configs from a JSON file.
 * @param {string} filePath - Absolute path to the JSON file.
 * @returns {Array<{userId: string, [key: string]: unknown}>}
 */
function readConfigsFromFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Imports user configs into a Firestore database.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {Array<{userId: string, [key: string]: unknown}>} configs
 */
async function importUserConfigs(db, configs) {
  for (const config of configs) {
    const { userId, ...rest } = config;
    await db.collection('userConfigs').doc(userId).set(rest);
    console.log(`Imported config for user: ${userId}`);
  }
  console.log('Import complete.');
}

if (require.main === module) {
  // Use the Firebase Emulator
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

  initializeApp({
    projectId: 'pushup-stats',
    credential: applicationDefault(),
  });

  const db = getFirestore();
  const configs = readConfigsFromFile(
    path.join(__dirname, '../../data/user-config-export.json')
  );

  importUserConfigs(db, configs).catch(console.error);
}

module.exports = { readConfigsFromFile, importUserConfigs };
