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

const FONT_URL =
  'https://github.com/rsms/inter/raw/v4.0/docs/font-files/Inter-Bold.woff';

let fontCache: ArrayBuffer | null = null;
let wasmInitialised = false;

async function loadFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  const res = await fetch(FONT_URL);
  if (!res.ok) {
    throw new Error(`OG font fetch failed: ${res.status} ${res.statusText}`);
  }
  fontCache = await res.arrayBuffer();
  return fontCache;
}

async function ensureResvgInitialised(): Promise<void> {
  if (wasmInitialised) return;
  // Locate the WASM binary inside the deployed bundle's node_modules.
  // createRequire so it works from a CJS bundle without import.meta.
  const require = createRequire(__filename);
  const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
  const wasmBytes = await readFile(wasmPath);
  await initWasm(wasmBytes);
  wasmInitialised = true;
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

/** Build the satori-friendly element tree for the profile OG card. */
export function buildOgTree(profile: PublicProfileProjection): SatoriElement {
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
        children: 'Pushup Tracker',
      }),
      el('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '12px' },
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
            children: `${profile.total.toLocaleString('de-DE')} Reps · Streak ${profile.currentStreak} · ${profile.totalDays} Tage`,
          }),
        ],
      }),
      el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          fontSize: '28px',
          color: '#8ca8e8',
        },
        children: 'pushup-stats.de',
      }),
    ],
  });
}

/**
 * Render a public-profile projection to a PNG buffer (1200×630).
 * Throws on font/resvg failures so callers can return a 500 explicitly.
 */
export async function renderProfileOg(
  profile: PublicProfileProjection
): Promise<Buffer> {
  const [font] = await Promise.all([loadFont(), ensureResvgInitialised()]);

  const svg = await satori(buildOgTree(profile) as never, {
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
  fontCache = null;
  wasmInitialised = false;
}
