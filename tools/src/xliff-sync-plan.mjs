/**
 * What syncing one locale file against `messages.xlf` should do, unit by
 * unit. Pure: no file system, so the decisions are testable.
 *
 * Four outcomes per unit:
 *
 * - **missing** — the locale has no such unit. Seed it with the German
 *   source as a fallback target so the production build (which treats a
 *   missing translation as an error) stays green.
 * - **refresh** — the locale carries an untouched fallback of an older
 *   German text. Replace both source and target.
 * - **repair** — the locale unit lost its `<source>` (an artefact of
 *   earlier hand edits). Write it back and leave the translation alone:
 *   nothing about it is stale.
 * - **stale** — the locale carries a real translation of German text that
 *   has since changed. Keep the translation live (better than showing
 *   German), update the source, and flip the segment to `initial`, which
 *   is what makes `detect-translation-gaps.mjs` list it. Without this
 *   step a reworded German string silently keeps its old translation in
 *   every locale, forever.
 */

const UNIT_RE = /<unit id="([^"]+)">[\s\S]*?<\/unit>/g;

export function extractUnits(xml) {
  const map = new Map();
  for (const match of xml.matchAll(UNIT_RE)) {
    map.set(match[1], match[0]);
  }
  return map;
}

/** Inner text of `<source>` / `<target>`; `null` for a self-closing tag. */
export function extractTag(unitXml, tag) {
  const paired = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(unitXml);
  if (paired) return paired[1];
  return new RegExp(`<${tag}\\s*/>`).test(unitXml) ? null : null;
}

export function hasTag(unitXml, tag) {
  return new RegExp(`<${tag}>|<${tag}\\s*/>`).test(unitXml);
}

/**
 * The text as a translator reads it: whitespace collapsed and every
 * placeholder reduced to its identity. `disp` carries the Angular
 * expression behind a placeholder and changes when code is refactored —
 * comparing it would flag units whose wording never moved.
 */
export function comparableText(text) {
  if (text === null || text === undefined) return '';
  const withIds = text.replace(
    /<(ph|pc|ec|sc)\b([^>]*?)\/?>/g,
    (_match, tag, attrs) => {
      const identity =
        /equivStart="([^"]*)"/.exec(attrs) ??
        /equiv="([^"]*)"/.exec(attrs) ??
        /id="([^"]*)"/.exec(attrs);
      return `<${tag}:${identity ? identity[1] : ''}>`;
    }
  );
  return withIds.replace(/\s+/g, ' ').trim();
}

/** The XML for a freshly seeded or refreshed fallback unit. */
export function fallbackUnit(id, source) {
  return `    <unit id="${id}">\n      <segment state="initial">\n        <source>${source}</source>\n        <target>${source}</target>\n      </segment>\n    </unit>`;
}

/** Rewrites one locale unit's source, optionally flipping its state. */
export function rewriteUnit(unitXml, source, { markInitial }) {
  let next = unitXml;
  next =
    next.includes('<source/>') || /<source\s*\/>/.test(next)
      ? next.replace(/<source\s*\/>/, `<source>${source}</source>`)
      : next.replace(
          /<source>[\s\S]*?<\/source>/,
          () => `<source>${source}</source>`
        );
  if (markInitial) {
    next = next.replace(
      /<segment(\s+state="[^"]*")?>/,
      '<segment state="initial">'
    );
  }
  return next;
}

/**
 * Decides what to do with one unit. `localeUnit` is `undefined` when the
 * locale does not have it yet.
 */
export function planUnit(id, sourceText, localeUnit) {
  if (!localeUnit) {
    return { id, action: 'missing', xml: fallbackUnit(id, sourceText) };
  }
  const localeSource = extractTag(localeUnit, 'source');
  const localeTarget = extractTag(localeUnit, 'target');
  const sourceMissing =
    localeSource === null || comparableText(localeSource) === '';
  const wanted = comparableText(sourceText);

  if (!sourceMissing && comparableText(localeSource) === wanted) {
    return { id, action: 'same' };
  }

  if (sourceMissing && comparableText(localeTarget) !== '') {
    // The translation is fine; only the source went missing.
    return {
      id,
      action: 'repair',
      xml: rewriteUnit(localeUnit, sourceText, { markInitial: false }),
    };
  }

  const isFallback =
    localeUnit.includes('state="initial"') &&
    comparableText(localeSource) === comparableText(localeTarget);
  if (isFallback) {
    return { id, action: 'refresh', xml: fallbackUnit(id, sourceText) };
  }

  return {
    id,
    action: 'stale',
    xml: rewriteUnit(localeUnit, sourceText, { markInitial: true }),
  };
}

/** Every unit's plan for one locale, in source order. */
export function planLocale(sourceUnits, localeUnits) {
  const plans = [];
  for (const [id, sourceUnit] of sourceUnits) {
    const sourceText = extractTag(sourceUnit, 'source') ?? '';
    plans.push(planUnit(id, sourceText, localeUnits.get(id)));
  }
  return plans;
}

export function countActions(plans) {
  const counts = { missing: 0, refresh: 0, repair: 0, stale: 0, same: 0 };
  for (const plan of plans) counts[plan.action] += 1;
  return counts;
}
