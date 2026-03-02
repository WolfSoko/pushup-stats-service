// Script to export all user configs from NeDB to a JSON file
const Datastore = require('nedb-promises');
const path = require('node:path');
const fs = require('node:fs');

/**
 * Exports all user configs from a NeDB datastore to a JSON file.
 * @param {import('nedb-promises').default} db
 * @param {string} outputPath - Absolute path for the output JSON file.
 */
async function exportNedbUserConfigs(db, outputPath) {
  const allConfigs = await db.find({});
  fs.writeFileSync(outputPath, JSON.stringify(allConfigs, null, 2));
  console.log(`Exported ${allConfigs.length} user configs.`);
}

if (require.main === module) {
  const DEFAULT_DB_PATH = path.join(__dirname, '../../data/user-config-dev.db');
  const DEFAULT_OUTPUT_PATH = path.join(
    __dirname,
    '../../data/user-config-export.json'
  );

  const db = Datastore.create({ filename: DEFAULT_DB_PATH, autoload: true });

  exportNedbUserConfigs(db, DEFAULT_OUTPUT_PATH).catch(console.error);
}

module.exports = { exportNedbUserConfigs };
