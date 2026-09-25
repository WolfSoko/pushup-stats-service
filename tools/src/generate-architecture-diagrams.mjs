/**
 * Regenerates `docs/architecture/diagrams.md` and `docs/architecture/metrics.json`
 * from the Nx project graph and the TypeScript sources.
 *
 *   node tools/src/generate-architecture-diagrams.mjs [--graph <nx-graph.json>]
 *
 * Without `--graph` it runs `nx graph --file=…` itself.
 */
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { buildMetrics } from './architecture-analysis.mjs';
import { renderDiagramsMarkdown } from './architecture-render.mjs';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'docs', 'architecture');
const SOURCE_DIRS = ['libs', 'web/src', 'data-store/functions/src'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.angular', 'coverage']);

function loadGraph() {
  const index = process.argv.indexOf('--graph');
  if (index !== -1)
    return JSON.parse(readFileSync(process.argv[index + 1], 'utf-8'));
  const dir = mkdtempSync(join(tmpdir(), 'nx-graph-'));
  const file = join(dir, 'graph.json');
  try {
    execFileSync('pnpm', ['nx', 'graph', `--file=${file}`], {
      stdio: 'inherit',
      env: { ...process.env, NX_DAEMON: 'false' },
    });
    return JSON.parse(readFileSync(file, 'utf-8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full);
    } else if (entry.name.endsWith('.ts')) {
      yield full;
    }
  }
}

function readSources() {
  const files = [];
  for (const dir of SOURCE_DIRS) {
    for (const full of walk(join(ROOT, dir))) {
      files.push({
        path: relative(ROOT, full).split(sep).join('/'),
        content: readFileSync(full, 'utf-8'),
      });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

const metrics = buildMetrics(loadGraph().graph, readSources());
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'diagrams.md'), renderDiagramsMarkdown(metrics));
writeFileSync(
  join(OUT_DIR, 'metrics.json'),
  `${JSON.stringify(metrics, null, 2)}\n`
);
// oxfmt aligns the Markdown tables; without it the pre-commit hook and
// `format:check` would reformat every regenerated file.
execFileSync('pnpm', ['exec', 'oxfmt', OUT_DIR], { stdio: 'ignore' });
console.log(
  `architecture: ${metrics.projects.length} projects, ${metrics.featureEdges.length} feature edges, ` +
    `${metrics.featureCycles.length} feature cycles, ${metrics.oversizedFiles.length} files > limit`
);
