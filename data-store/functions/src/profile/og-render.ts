/**
 * Renders the OpenGraph card for `/u/:uid`.
 *
 * Decoupled from Firebase: takes a `PublicProfileProjection`, returns a PNG
 * Buffer. This way the heavy bits (satori SVG layout + resvg WASM rasterise)
 * stay testable in isolation and the HTTP wrapper in `index.ts` is a thin
 * request-shaping shim.
 *
 * The font is fetched once at first call and cached in module scope. Cold
 * start adds ~150ms for the woff fetch; warm starts pay nothing extra.
 * Falling back to satori's empty-font path is not an option — the library
 * throws without a font, so a fetch failure here surfaces as an HTTP 500
 * upstream rather than a silently broken card.
 */

import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { PublicProfileProjection } from './public-profile';

// Direct CDN URL (no GitHub redirect), pinned to a release tag for stability.
const FONT_URL =
  'https://raw.githubusercontent.com/rsms/inter/v4.0/docs/font-files/Inter-Bold.woff';
const FONT_FETCH_TIMEOUT_MS = 5_000;

// Cloud Functions Gen2 instances handle concurrent requests, so a plain
// boolean / `null` check around the awaited work would let two cold-start
// requests both run `initWasm()` (corrupting the global WASM state) or both
// fetch the font twice. Cache the in-flight Promise instead so every caller
// awaits the same work; on rejection clear the slot so the next attempt
// retries from scratch.
let fontPromise: Promise<ArrayBuffer> | null = null;
let wasmPromise: Promise<void> | null = null;

async function loadFont(): Promise<ArrayBuffer> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FONT_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(FONT_URL, { signal: ctrl.signal });
        if (!res.ok) {
          throw new Error(
            `OG font fetch failed: ${res.status} ${res.statusText}`
          );
        }
        return await res.arrayBuffer();
      } finally {
        clearTimeout(timer);
      }
    })().catch((err) => {
      // Don't poison future attempts with a rejected cached promise.
      fontPromise = null;
      throw err;
    });
  }
  return fontPromise;
}

async function ensureResvgInitialised(): Promise<void> {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      // Locate the WASM binary inside the deployed bundle's node_modules.
      // createRequire so it works from a CJS bundle without import.meta.
      const require = createRequire(__filename);
      const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
      const wasmBytes = await readFile(wasmPath);
      await initWasm(wasmBytes);
    })().catch((err) => {
      wasmPromise = null;
      throw err;
    });
  }
  return wasmPromise;
}

const WIDTH = 1200;
const HEIGHT = 630;

interface SatoriElement {
  type: string;
  props: {
    style?: Record<string, unknown>;
    children?: SatoriElement | SatoriElement[] | string | number;
  };
}

function el(type: string, props: SatoriElement['props']): SatoriElement {
  return { type, props };
}

export type OgLocale = 'de' | 'en';

interface OgCopy {
  /** Intl locale tag for `toLocaleString` number formatting. */
  numberLocale: string;
  /** Suffix label between the streak count and active-day count (e.g. "Tage" / "days"). */
  daysLabel: string;
  /** Headline above the displayName (call-to-action context, e.g. "💪 X reps tracked"). */
  headline: string;
  /** Footer call-to-action (e.g. "Track yours – pushup-stats.com"). */
  cta: string;
}

const OG_COPY: Readonly<Record<OgLocale, OgCopy>> = {
  de: {
    numberLocale: 'de-DE',
    daysLabel: 'Tage',
    headline: 'Pushup-Profil',
    cta: 'Selbst tracken — kostenlos auf pushup-stats.com',
  },
  en: {
    numberLocale: 'en-US',
    daysLabel: 'days',
    headline: 'Push-up profile',
    cta: 'Track yours — free at pushup-stats.com',
  },
};

function copyFor(locale: OgLocale | string | undefined): OgCopy {
  return OG_COPY[locale === 'en' ? 'en' : 'de'];
}

/** Build the satori-friendly element tree for the profile OG card. */
export function buildOgTree(
  profile: PublicProfileProjection,
  locale: OgLocale | string | undefined = 'de'
): SatoriElement {
  const copy = copyFor(locale);
  return el('div', {
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '64px 72px',
      background:
        'linear-gradient(135deg, rgb(11, 17, 31) 0%, rgb(31, 47, 84) 60%, rgb(63, 128, 255) 140%)',
      color: '#f4f8ff',
      fontFamily: 'Inter',
    },
    children: [
      el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          fontSize: '32px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#9fb3de',
        },
        children: `Pushup Tracker · ${copy.headline}`,
      }),
      el('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '14px' },
        children: [
          el('div', {
            style: {
              fontSize: '88px',
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: '90%',
              overflow: 'hidden',
            },
            children: profile.displayName,
          }),
          el('div', {
            style: {
              fontSize: '36px',
              color: '#dbe7ff',
            },
            children: `${profile.total.toLocaleString(copy.numberLocale)} Reps · Streak ${profile.currentStreak} · ${profile.totalDays} ${copy.daysLabel}`,
          }),
        ],
      }),
      el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          fontSize: '32px',
          fontWeight: 600,
          color: '#f4f8ff',
        },
        children: copy.cta,
      }),
    ],
  });
}

/**
 * Render a public-profile projection to a PNG buffer (1200×630).
 * Throws on font/resvg failures so callers can return a 500 explicitly.
 *
 * `locale` controls number formatting and copy ("Tage" vs "days") so the
 * card renders in the language matching the share-link source page.
 * Defaults to `'de'` (the source locale).
 */
export async function renderProfileOg(
  profile: PublicProfileProjection,
  locale: OgLocale | string | undefined = 'de'
): Promise<Buffer> {
  const [font] = await Promise.all([loadFont(), ensureResvgInitialised()]);

  const svg = await satori(buildOgTree(profile, locale) as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      {
        name: 'Inter',
        data: font,
        weight: 700,
        style: 'normal',
      },
    ],
  });

  const resvg = new Resvg(svg, {
    background: 'rgb(11, 17, 31)',
    fitTo: { mode: 'width', value: WIDTH },
  });
  return Buffer.from(resvg.render().asPng());
}

/** Test-only helper to flush the in-memory caches between specs. */
export function _resetOgCachesForTesting(): void {
  fontPromise = null;
  wasmPromise = null;
}
