/**
 * What `generate-content.mjs` reads and writes, as workspace-root-relative
 * paths. Kept in one module because three places must agree on the list:
 * the generator, `tools/project.json` (`generate-content` inputs/outputs) and
 * `.prettierignore` — `generated-content-paths.spec.js` pins them together.
 *
 * The generated files are git-tracked sources that `web:build` hashes as
 * inputs. A write path missing from `outputs` is not restored on a cache hit,
 * so its bytes on disk depend on whether the generator ran — which changes
 * `web:build`'s hash between machines and permanently misses the remote cache
 * the App Hosting rollout depends on (docs/gotchas/build-and-tooling.md).
 * Prettier reformatting one of them causes the same drift.
 */
export const CONTENT_SOURCE_GLOBS = [
  'content/blog/**/*.md',
  'content/wiki/pushup-types/*.md',
  'content/wiki/exercises/*.md',
];

export const GENERATED_CONTENT_PATHS = {
  blogDir: 'web/src/app/blog/generated',
  pushupTypes: 'libs/stats/src/lib/models/pushup-type-content.generated.ts',
  exerciseWiki: 'libs/stats/src/lib/models/exercise-wiki-content.generated.ts',
};
