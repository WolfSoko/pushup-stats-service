// Thin wrapper – canonical implementation lives in tools/src/.
// Prefer using the Nx target: nx run tools:import-user-configs
const {
  readConfigsFromFile,
  importUserConfigs,
} = require('../tools/src/import-user-configs-to-firestore');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('node:path');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

initializeApp({
  projectId: 'pushup-stats',
  credential: applicationDefault(),
});

const db = getFirestore();
const configs = readConfigsFromFile(
  path.join(__dirname, '../data/user-config-export.json')
);

importUserConfigs(db, configs).catch(console.error);
