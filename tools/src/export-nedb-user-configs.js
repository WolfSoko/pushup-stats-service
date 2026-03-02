// Script to export all user configs from NeDB to a JSON file
const Datastore = require('nedb-promises');
const path = require('node:path');
const fs = require('node:fs');

const DEFAULT_DB_PATH = path.join(__dirname, '../../data/user-config-dev.db');

const db = Datastore.create({ filename: DEFAULT_DB_PATH, autoload: true });

(async () => {
  const allConfigs = await db.find({});
  fs.writeFileSync(
    path.join(__dirname, '../../data/user-config-export.json'),
    JSON.stringify(allConfigs, null, 2)
  );
  console.log(`Exported ${allConfigs.length} user configs.`);
})();
