const { readdirSync, readFileSync, statSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

const GRAPHICS_ROOT = resolve(__dirname, '../..', 'store/graphics');

/**
 * Play's limits for the assets we publish. They are rejected at upload
 * time, which is the worst place to find out — the store copy already
 * learned that lesson (`play-listing-source.mjs`).
 */
const LIMITS = {
  screenshot: {
    min: 320,
    max: 3840,
    maxAspect: 2,
    minCount: 2,
    maxCount: 8,
    maxBytes: 8 * 1024 * 1024,
  },
  feature: { width: 1024, height: 500 },
  icon: { width: 512, height: 512, maxBytes: 1024 * 1024 },
};

/**
 * Reads width/height straight out of the PNG header. A dependency-free
 * read keeps this guard runnable in CI without an image library: the
 * IHDR chunk is always the first one and its layout is fixed.
 */
function pngSize(path) {
  const buf = readFileSync(path);
  const isPng = buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47;
  if (!isPng) throw new Error(`${path} is not a PNG`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bytes: buf.length,
  };
}

function localeDirs() {
  if (!existsSync(GRAPHICS_ROOT)) return [];
  return readdirSync(GRAPHICS_ROOT).filter((entry) =>
    statSync(join(GRAPHICS_ROOT, entry)).isDirectory()
  );
}

describe('Play store graphics', () => {
  it('should keep one locale directory with screenshots', () => {
    // given the graphics tree
    const locales = localeDirs();
    // then at least the source locale is covered
    expect(locales).toContain('de-DE');
  });

  describe.each(localeDirs())('%s', (locale) => {
    const dir = join(GRAPHICS_ROOT, locale);
    const screenshots = readdirSync(dir).filter(
      (f) => f.startsWith('screenshot-') && f.endsWith('.png')
    );

    it('should ship between two and eight screenshots', () => {
      // given the locale's screenshots
      const { minCount, maxCount } = LIMITS.screenshot;
      // then Play's per-locale bounds hold
      expect(screenshots.length).toBeGreaterThanOrEqual(minCount);
      expect(screenshots.length).toBeLessThanOrEqual(maxCount);
    });

    it.each(screenshots)(
      'should keep %s inside Play’s size and aspect limits',
      (file) => {
        // given one screenshot
        const { width, height, bytes } = pngSize(join(dir, file));
        const { min, max, maxAspect, maxBytes } = LIMITS.screenshot;
        // then every side is in range …
        expect(Math.min(width, height)).toBeGreaterThanOrEqual(min);
        expect(Math.max(width, height)).toBeLessThanOrEqual(max);
        // … the frame is no longer than 2:1, which Play refuses …
        expect(
          Math.max(width, height) / Math.min(width, height)
        ).toBeLessThanOrEqual(maxAspect);
        // … and the file is small enough to upload
        expect(bytes).toBeLessThanOrEqual(maxBytes);
      }
    );

    it('should size the feature graphic exactly 1024×500', () => {
      // given the locale's feature graphic
      const path = join(dir, 'feature-graphic.png');
      expect(existsSync(path)).toBe(true);
      // then it matches the only size Play accepts
      const { width, height } = pngSize(path);
      expect({ width, height }).toEqual(LIMITS.feature);
    });
  });

  it('should keep the store icon at 512×512', () => {
    // given the icon shared across locales
    const path = join(GRAPHICS_ROOT, 'store-icon.png');
    expect(existsSync(path)).toBe(true);
    // then it matches the Play Console requirement
    const { width, height, bytes } = pngSize(path);
    expect({ width, height }).toEqual({
      width: LIMITS.icon.width,
      height: LIMITS.icon.height,
    });
    expect(bytes).toBeLessThanOrEqual(LIMITS.icon.maxBytes);
  });
});
