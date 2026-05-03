import {
  HASHED_ASSET_CACHE_CONTROL,
  SHORT_LIVED_CACHE_CONTROL,
  isHashedAsset,
  staticCacheControl,
} from './server-static-cache';

describe('isHashedAsset', () => {
  describe('Given a content-hashed asset filename, Then returns true', () => {
    it.each([
      // Angular esbuild chunks: `name-HASH.ext`
      'main-ABCD1234.js',
      'chunk-7H7K2KX5.js',
      'polyfills-XYZABC9Z.mjs',
      'styles-AB12CD34.css',
      // Legacy / asset-hashing format: `name.HASH.ext`
      'main.ABCD1234.js',
      'styles.7H7K2KX5.css',
      'logo.AB12CD34.png',
      // Hashed fonts and images
      'roboto-12345678.woff2',
      'hero.A1B2C3D4.webp',
      'icon-9F8E7D6C.svg',
      'sourcemap-ABCD1234.map',
      // Full path resolved by serve-static
      '/var/app/dist/web/browser/de/main-ABCD1234.js',
      // Long base32 hash (Angular sometimes uses 12+ chars)
      'main-ABCDEFGH12345678.js',
    ])('%s', (filePath) => {
      expect(isHashedAsset(filePath)).toBe(true);
    });
  });

  describe('Given a stable / non-hashed filename, Then returns false', () => {
    it.each([
      'index.html',
      'index.csr.html',
      'manifest.webmanifest',
      'favicon.ico',
      'robots.txt',
      'sitemap.xml',
      'ads.txt',
      'ngsw.json',
      'ngsw-worker.js',
      'safety-worker.js',
      // Hash too short (< 8 chars) — not Angular's output, treat as stable
      'main-AB12.js',
      // No separator before the hash-like sequence
      'mainABCD1234.js',
      // Hash-like directory segment but stable filename — must not match
      '/dist/ABCD1234XYZ/index.html',
      // Hash inside an unsupported extension
      'data-ABCD1234.json',
    ])('%s', (filePath) => {
      expect(isHashedAsset(filePath)).toBe(false);
    });
  });
});

describe('staticCacheControl', () => {
  it('Given a hashed asset, Then returns the immutable 1-year policy', () => {
    expect(staticCacheControl('main-ABCD1234.js')).toBe(
      HASHED_ASSET_CACHE_CONTROL
    );
    expect(HASHED_ASSET_CACHE_CONTROL).toBe(
      'public, max-age=31536000, immutable'
    );
  });

  it('Given a stable filename, Then returns the short-lived policy', () => {
    expect(staticCacheControl('manifest.webmanifest')).toBe(
      SHORT_LIVED_CACHE_CONTROL
    );
    expect(SHORT_LIVED_CACHE_CONTROL).toBe('public, max-age=300');
  });

  it('Both policies start with `public,` so App Hosting`s CDN treats them as cacheable', () => {
    // Firebase App Hosting only caches responses with `Cache-Control: public`
    // and an explicit max-age. A regression that drops `public` would
    // silently disable CDN caching across the fleet.
    expect(HASHED_ASSET_CACHE_CONTROL.startsWith('public,')).toBe(true);
    expect(SHORT_LIVED_CACHE_CONTROL.startsWith('public,')).toBe(true);
    expect(HASHED_ASSET_CACHE_CONTROL).toMatch(/max-age=\d+/);
    expect(SHORT_LIVED_CACHE_CONTROL).toMatch(/max-age=\d+/);
  });
});
