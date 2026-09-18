const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const RELEASE_MODULE = resolve(__dirname, 'publish-play-release.mjs');

// The module is ESM; `tools/jest.config.cjs` only transforms `.ts`/`.js`, so
// exercise it in a throwaway node subprocess — same pattern as
// play-listing-source.spec.js.
function runInModule(modulePath, expression) {
  const script = `
    import * as mod from ${JSON.stringify(modulePath)};
    const run = async () => (${expression});
    run().then(
      (value) => process.stdout.write(JSON.stringify({ ok: true, value })),
      (error) => process.stdout.write(JSON.stringify({ ok: false, message: error.message }))
    );
  `;
  return JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', script], {
      encoding: 'utf-8',
    })
  );
}

/**
 * Runs `publishRelease` against a fake API inside the subprocess and returns
 * the recorded call sequence, so the release transaction can be asserted
 * without uploading anything to Google.
 *
 * `failOn` lists API methods that should throw, to exercise the cleanup path.
 */
function runRelease({ track = 'internal', commit, failOn = [] }) {
  const expression = `(async () => {
    const calls = [];
    const failing = ${JSON.stringify([].concat(failOn))};
    const record = (name) => (...args) => {
      calls.push([name, ...args]);
      if (failing.includes(name)) throw new Error('boom:' + name);
      return undefined;
    };
    const api = {
      createEdit: async (...a) => { record('createEdit')(...a); return { id: 'edit-1' }; },
      uploadBundle: async (editId, bytes) => {
        calls.push(['uploadBundle', editId, bytes.length]);
        if (failing.includes('uploadBundle')) throw new Error('boom:uploadBundle');
        return { versionCode: 1302 };
      },
      assignTrack: async (...a) => record('assignTrack')(...a),
      commitEdit: async (...a) => record('commitEdit')(...a),
      deleteEdit: async (...a) => record('deleteEdit')(...a),
    };
    try {
      const versionCode = await mod.publishRelease({
        bundle: { bytes: new Uint8Array(7), size: 7 },
        track: ${JSON.stringify(track)},
        commit: ${JSON.stringify(commit)},
        api,
        log: () => {},
      });
      return { calls, versionCode };
    } catch (error) {
      return { calls, failed: error.message };
    }
  })()`;
  return runInModule(RELEASE_MODULE, expression).value;
}

function call(expression) {
  return runInModule(RELEASE_MODULE, expression);
}

describe('publish-play-release', () => {
  describe('parseArgs', () => {
    it('should default to the internal track, which reaches no real user', () => {
      // given / when
      const result = call(`mod.parseArgs(['--bundle=app.aab'])`);

      // then
      expect(result.value).toEqual({
        commit: false,
        track: 'internal',
        bundle: 'app.aab',
      });
    });

    it('should refuse a track Play does not have', () => {
      // given a plausible typo for "production"
      // when
      const result = call(`mod.parseArgs(['--bundle=a.aab', '--track=prod'])`);

      // then it names the valid set rather than failing at upload time
      expect(result.ok).toBe(false);
      expect(result.message).toContain('internal, alpha, beta, production');
    });

    it('should require a bundle path', () => {
      // given / when
      const result = call(`mod.parseArgs(['--commit'])`);

      // then
      expect(result.ok).toBe(false);
      expect(result.message).toContain('--bundle is required');
    });

    it('should not read a blank --bundle as an absent one', () => {
      // given — an empty CI variable expanded into the flag
      // when
      const result = call(`mod.parseArgs(['--bundle='])`);

      // then the message points at the empty value, not a missing flag
      expect(result.ok).toBe(false);
      expect(result.message).toContain('needs a path');
    });
  });

  describe('readBundle', () => {
    let dir;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'play-release-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('should reject an APK, which this app cannot ship', () => {
      // given
      const path = join(dir, 'app-release.apk');
      writeFileSync(path, 'x');

      // when
      const result = call(`mod.readBundle(${JSON.stringify(path)})`);

      // then
      expect(result.ok).toBe(false);
      expect(result.message).toContain('not an .aab');
    });

    it('should reject an empty bundle before opening an edit', () => {
      // given — what a failed Gradle build leaves behind
      const path = join(dir, 'app-release.aab');
      writeFileSync(path, '');

      // when
      const result = call(`mod.readBundle(${JSON.stringify(path)})`);

      // then
      expect(result.ok).toBe(false);
      expect(result.message).toContain('empty');
    });

    it('should report a missing bundle by path', () => {
      // given / when
      const path = join(dir, 'nope.aab');
      const result = call(`mod.readBundle(${JSON.stringify(path)})`);

      // then
      expect(result.ok).toBe(false);
      expect(result.message).toContain('Bundle not found');
    });
  });

  describe('publishRelease', () => {
    it('should upload nothing on a dry run', () => {
      // given / when
      const { calls, versionCode } = runRelease({ commit: false });

      // then not even an edit is opened
      expect(calls).toEqual([]);
      expect(versionCode).toBeNull();
    });

    it('should upload, assign the track and commit, in that order', () => {
      // given / when
      const { calls, versionCode } = runRelease({ commit: true });

      // then
      expect(calls.map(([name]) => name)).toEqual([
        'createEdit',
        'uploadBundle',
        'assignTrack',
        'commitEdit',
      ]);
      // and the track assignment uses the versionCode Play reported, not a
      // locally guessed one
      expect(calls[2]).toEqual(['assignTrack', 'edit-1', 'internal', 1302]);
      expect(versionCode).toBe(1302);
    });

    it('should discard the edit when the upload fails', () => {
      // given an upload that throws — a left-open edit blocks the next run
      // with a conflict
      const { calls, failed } = runRelease({
        commit: true,
        failOn: 'uploadBundle',
      });

      // then
      expect(calls.map(([name]) => name)).toEqual([
        'createEdit',
        'uploadBundle',
        'deleteEdit',
      ]);
      // and the original failure surfaces, not the cleanup
      expect(failed).toBe('boom:uploadBundle');
    });

    it('should not commit when the track assignment fails', () => {
      // given / when
      const { calls, failed } = runRelease({
        commit: true,
        failOn: 'assignTrack',
      });

      // then the bundle stays uploaded but unreleased, and the edit is gone
      expect(calls.map(([name]) => name)).toEqual([
        'createEdit',
        'uploadBundle',
        'assignTrack',
        'deleteEdit',
      ]);
      expect(failed).toBe('boom:assignTrack');
    });
  });
});
