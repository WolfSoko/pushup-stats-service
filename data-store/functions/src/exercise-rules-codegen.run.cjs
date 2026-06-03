/*
 * Thin bootstrap so `nx run cloud-functions:generate-exercise-rules` can run
 * the TypeScript codegen directly. The repo has no installed TS-script runner
 * on PATH; ts-node + tsconfig-paths are dependencies, so register them here
 * (tsconfig-paths needs an explicit baseUrl because the `@pu-stats/models`
 * alias in tsconfig.base.json is resolved from the workspace root). Keeping
 * the logic in `exercise-rules-codegen.ts` lets Jest cover it.
 */
const { join } = require('node:path');
const { readFileSync, writeFileSync } = require('node:fs');

const workspaceRoot = join(__dirname, '..', '..', '..');

require('ts-node').register({
  project: join(__dirname, '..', 'tsconfig.spec.json'),
  transpileOnly: true,
});
require('tsconfig-paths').register({
  baseUrl: workspaceRoot,
  paths: require(join(workspaceRoot, 'tsconfig.base.json')).compilerOptions
    .paths,
});

const { renderRulesAllowlists } = require('./exercise-rules-codegen.ts');

const rulesPath = join(workspaceRoot, 'data-store', 'firestore.rules');
const current = readFileSync(rulesPath, 'utf8');
const next = renderRulesAllowlists(current);

if (next === current) {
  process.stdout.write('firestore.rules allowlists already up to date.\n');
} else {
  writeFileSync(rulesPath, next);
  process.stdout.write(
    'firestore.rules allowlists regenerated from EXERCISE_CATALOG.\n'
  );
}
