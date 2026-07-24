const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('yaml');

const ROOT = resolve(__dirname, '../..');

/**
 * Locks in the primary defense against App Hosting prerender build failures:
 * the NG_BUILD_MAX_WORKERS=2 cap in both apphosting configs.
 *
 * The App Hosting builder has ~8 GB RAM; the main build process needs a 6 GB
 * heap and each prerender worker thread adds its own V8 isolate. With the
 * default 4 workers the ~2400-route prerender (9 locales, `sourceMap: true`)
 * thrashes into memory-pressure stalls late in the build, aborting the whole
 * build. Capping workers keeps peak memory inside the machine.
 */
describe('App Hosting prerender worker cap', () => {
  it.each(['apphosting.yaml', 'apphosting.staging.yaml'])(
    'should cap prerender workers at BUILD time in %s',
    (configFile) => {
      // given the ~8 GB App Hosting builder that thrashes with 4 workers
      const config = parse(readFileSync(resolve(ROOT, configFile), 'utf-8'));
      // when App Hosting resolves the build-time environment
      const workersEntry = (config.env ?? []).find(
        (entry) => entry && entry.variable === 'NG_BUILD_MAX_WORKERS'
      );
      // then the worker cap is bound at BUILD availability and stays small
      expect(workersEntry).toBeDefined();
      expect(workersEntry.availability).toEqual(['BUILD']);
      expect(Number(workersEntry.value)).toBeGreaterThanOrEqual(1);
      expect(Number(workersEntry.value)).toBeLessThanOrEqual(2);
    }
  );
});
