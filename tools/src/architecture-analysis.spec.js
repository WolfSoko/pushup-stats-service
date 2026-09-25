const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');

const ANALYSIS = resolve(__dirname, 'architecture-analysis.mjs');
const RENDER = resolve(__dirname, 'architecture-render.mjs');

// ESM modules; see xliff-sync-plan.spec.js for why this runs in a subprocess.
function run(expression) {
  const script = `
    import * as analysis from ${JSON.stringify(ANALYSIS)};
    import * as render from ${JSON.stringify(RENDER)};
    const run = async () => (${expression});
    run().then(
      (value) => process.stdout.write(JSON.stringify({ ok: true, value })),
      (error) => process.stdout.write(JSON.stringify({ ok: false, message: error.message }))
    );
  `;
  const result = JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', script], {
      encoding: 'utf-8',
    })
  );
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const lines = (n) =>
  Array.from({ length: n }, (_, i) => `const a${i} = ${i};`).join('\n');

const GRAPH = {
  nodes: {
    web: {
      name: 'web',
      type: 'app',
      data: { root: 'web', tags: ['scope:app'] },
    },
    models: {
      name: 'models',
      type: 'lib',
      data: { root: 'libs/stats', tags: ['scope:models'] },
    },
    access: {
      name: 'access',
      type: 'lib',
      data: { root: 'libs/data-access', tags: ['scope:data-access'] },
    },
  },
  dependencies: {
    web: [
      { source: 'web', target: 'access', type: 'static' },
      { source: 'web', target: 'npm:@angular/core', type: 'static' },
    ],
    access: [{ source: 'access', target: 'models', type: 'static' }],
    models: [],
  },
};

const FILES = [
  {
    path: 'web/src/app/app.routes.ts',
    content: "import { A } from './stats/a';\n",
  },
  {
    path: 'web/src/app/stats/a.ts',
    content: "import { C } from '../core/c';\nimport { B } from './b';\n",
  },
  {
    path: 'web/src/app/stats/b.ts',
    content: "import { C } from '../core/c';\n",
  },
  {
    path: 'web/src/app/stats/a.spec.ts',
    content: "import { F } from '../friends/f';\n",
  },
  {
    path: 'web/src/app/core/c.ts',
    content: "const x = () => import('../stats/a');\n",
  },
  {
    path: 'web/src/app/core/index-user.ts',
    content: "import { S } from '../stats';\n",
  },
  {
    path: 'web/src/app/friends/f.ts',
    content: "import { C } from '../core/c';\n",
  },
  { path: 'libs/stats/src/big.ts', content: lines(300) },
  { path: 'libs/stats/src/big.catalog.ts', content: lines(900) },
  {
    path: 'libs/data-access/src/api.ts',
    content: "import { M } from '@pu-stats/models';\n",
  },
];

describe('architecture-analysis', () => {
  it('should treat only non-test, non-generated TypeScript as prod source', () => {
    // given
    const paths = [
      'libs/x/src/a.ts',
      'libs/x/src/a.spec.ts',
      'libs/x/src/a.generated.ts',
      'libs/x/src/a.catalog.ts',
      'libs/x/src/pushup-type-content.ts',
      'web/src/app/blog/generated/post.ts',
      'web/web-e2e/src/login.ts',
      'libs/x/src/a.html',
    ];

    // when
    const prod = run(`${JSON.stringify(paths)}.filter(analysis.isProdSource)`);

    // then
    expect(prod).toEqual(['libs/x/src/a.ts']);
  });

  it('should map files to their top-level web feature folder or the app shell', () => {
    // when
    const result = run(`[
      analysis.featureOfFile('web/src/app/stats/shell/x.ts'),
      analysis.featureOfFile('web/src/app/app.routes.ts'),
      analysis.featureOfFile('libs/ui/src/index.ts'),
    ]`);

    // then
    expect(result).toEqual(['stats', 'app-shell', null]);
  });

  it('should count cross-feature imports per importing file and ignore specs and intra-feature imports', () => {
    // when
    const edges = run(`analysis.featureImportEdges(${JSON.stringify(FILES)})`);

    // then
    expect(edges).toEqual([
      { source: 'app-shell', target: 'stats', count: 1 },
      { source: 'core', target: 'stats', count: 2 },
      { source: 'friends', target: 'core', count: 1 },
      { source: 'stats', target: 'core', count: 2 },
    ]);
  });

  it('should report each multi-member strongly connected component once', () => {
    // given
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' },
      { source: 'c', target: 'd' },
      { source: 'd', target: 'e' },
      { source: 'e', target: 'd' },
      { source: 'x', target: 'a' },
    ];

    // when
    const cycles = run(`analysis.findCycles(${JSON.stringify(edges)})`);

    // then
    expect(cycles).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ]);
  });

  it('should compute afferent, efferent coupling and instability', () => {
    // when
    const result = run(`analysis.coupling([
      { source: 'web', target: 'access' },
      { source: 'access', target: 'models' },
    ])`);

    // then
    expect(result).toEqual({
      access: { afferent: 1, efferent: 1, instability: 0.5 },
      models: { afferent: 1, efferent: 0, instability: 0 },
      web: { afferent: 0, efferent: 1, instability: 1 },
    });
  });

  it('should drop npm nodes from the project graph and flag oversized prod files only', () => {
    // when
    const metrics = run(
      `analysis.buildMetrics(${JSON.stringify(GRAPH)}, ${JSON.stringify(FILES)})`
    );

    // then
    expect(metrics.projectEdges).toEqual([
      { source: 'access', target: 'models', type: 'static' },
      { source: 'web', target: 'access', type: 'static' },
    ]);
    expect(metrics.oversizedFiles).toEqual([
      { path: 'libs/stats/src/big.ts', loc: 300 },
    ]);
    expect(metrics.projectSizes.models).toEqual({
      files: 1,
      loc: 300,
      oversized: 1,
    });
    expect(metrics.featureCycles).toEqual([['core', 'stats']]);
  });
});

describe('architecture-render', () => {
  it('should render deterministic Mermaid diagrams with sanitized ids and flagged cycles', () => {
    // when
    const [first, second] = run(`(() => {
      const metrics = analysis.buildMetrics(${JSON.stringify(GRAPH)}, ${JSON.stringify(FILES)});
      return [render.renderDiagramsMarkdown(metrics), render.renderDiagramsMarkdown(metrics)];
    })()`);

    // then
    expect(first).toBe(second);
    expect(first).toContain('```mermaid\nflowchart TD');
    expect(first).toContain('  web --> access');
    expect(first).toContain('  app_shell --> stats');
    expect(first).toContain('  core -->|2| stats');
    expect(first).toContain('  class core,stats cyclic');
    expect(first).toContain('- `core` ↔ `stats`');
    expect(first).toContain('| `libs/stats/src/big.ts` | 300 |');
  });

  it('should say so when there are no cycles and no oversized files', () => {
    // when
    const markdown = run(`render.renderDiagramsMarkdown(analysis.buildMetrics(
      ${JSON.stringify(GRAPH)},
      [{ path: 'libs/stats/src/small.ts', content: 'export const a = 1;\\n' }]
    ))`);

    // then
    expect(markdown).toContain('_Keine Zyklen._');
    expect(markdown).toContain('_Keine Prod-Datei über 250 LOC._');
  });
});
