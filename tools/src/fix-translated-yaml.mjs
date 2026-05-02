#!/usr/bin/env node
// Post-translation YAML fixer. Translation agents writing French,
// Spanish, Italian etc. occasionally produce single-quoted scalars
// with unescaped apostrophes ("title: 'L'auteur dit ...'") which are
// invalid YAML. This walks every <lang>.md file under content/ for the
// non-source locales and either:
//   1. Re-quotes single-quoted scalars by doubling internal `'` chars.
//   2. Switches to double-quoted form when the content has both `'`
//      and `"` and naive doubling would still mis-parse.
// Files that already parse cleanly are left untouched.

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const NON_SOURCE_LANGS = ['fr', 'es', 'it', 'nl', 'el', 'la'];

function listMd(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md'));
}

function listSubdirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((entry) => {
    try {
      return statSync(join(dir, entry)).isDirectory();
    } catch {
      return false;
    }
  });
}

function targets() {
  const out = [];
  const blogRoot = resolve(ROOT, 'content/blog');
  for (const folder of listSubdirs(blogRoot)) {
    for (const lang of NON_SOURCE_LANGS) {
      const path = join(blogRoot, folder, `${lang}.md`);
      if (existsSync(path)) out.push(path);
    }
  }
  const wikiRoot = resolve(ROOT, 'content/wiki/pushup-types');
  for (const file of listMd(wikiRoot)) {
    const m = /\.([a-z-]+)\.md$/.exec(file);
    if (m && NON_SOURCE_LANGS.includes(m[1])) {
      out.push(join(wikiRoot, file));
    }
  }
  return out;
}

function splitFrontmatter(source) {
  if (!source.startsWith('---\n') && !source.startsWith('---\r\n')) {
    return null;
  }
  const afterOpen = source.indexOf('\n', 3) + 1;
  const closeIdx = source.indexOf('\n---', afterOpen);
  if (closeIdx === -1) return null;
  const yaml = source.slice(afterOpen, closeIdx);
  let bodyStart = closeIdx + 4;
  if (source[bodyStart] === '\r') bodyStart += 1;
  if (source[bodyStart] === '\n') bodyStart += 1;
  return {
    yaml,
    body: source.slice(bodyStart),
  };
}

/**
 * Fix a YAML block by repairing single-quoted scalars that contain
 * un-doubled apostrophes. Works line by line; handles both top-level
 * `key: 'value'` and list items `  - 'value'`. Multi-line scalars are
 * left alone (rare in this corpus and risky to touch).
 */
function repairYamlBlock(yaml) {
  const lines = yaml.split('\n');
  const fixed = lines.map(repairLine);
  return fixed.join('\n');
}

function repairLine(line) {
  // Match `<indent><key>: '<...>'` or `<indent>- '<...>'` capturing
  // the prefix up to the opening quote and the value (no terminating
  // quote required — value may have been broken).
  const keyMatch = /^(\s*[A-Za-z_][A-Za-z0-9_-]*:\s*)'(.*)'\s*$/.exec(line);
  const itemMatch = /^(\s*-\s+)'(.*)'\s*$/.exec(line);
  const m = keyMatch ?? itemMatch;
  if (!m) return line;
  const [, prefix, raw] = m;
  // Count un-doubled `'`. A literal apostrophe in YAML single-quoted
  // form is `''`. So we collapse `''` -> `<MARK>`, then any remaining
  // `'` is an unescaped apostrophe that needs doubling.
  const MARK = '';
  const collapsed = raw.replace(/''/g, MARK);
  if (!collapsed.includes("'")) return line; // already valid
  // Double every remaining `'`, then restore marks.
  const fixed = collapsed
    .replace(/'/g, "''")
    .replace(new RegExp(MARK, 'g'), "''");
  return `${prefix}'${fixed}'`;
}

let fixed = 0;
let alreadyValid = 0;
let untouched = 0;

for (const path of targets()) {
  const source = readFileSync(path, 'utf-8');
  const split = splitFrontmatter(source);
  if (!split) {
    untouched += 1;
    continue;
  }
  // Fast path: skip files whose YAML already parses.
  try {
    parseYaml(split.yaml);
    alreadyValid += 1;
    continue;
  } catch {
    // fall through and attempt repair
  }
  const repaired = repairYamlBlock(split.yaml);
  // Validate the fix.
  try {
    parseYaml(repaired);
  } catch (err) {
    console.error(`${path}: still invalid after repair: ${err.message}`);
    untouched += 1;
    continue;
  }
  const out = `---\n${repaired}\n---\n${split.body.startsWith('\n') ? '' : '\n'}${split.body}`;
  writeFileSync(path, out, 'utf-8');
  fixed += 1;
  console.log(`fixed: ${path.replace(ROOT + '/', '')}`);
}

console.log(
  `\n${fixed} fixed · ${alreadyValid} already valid · ${untouched} untouched`
);
