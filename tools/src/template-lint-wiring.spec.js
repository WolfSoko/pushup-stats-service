const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '../..');

function nxJson() {
  return JSON.parse(readFileSync(resolve(ROOT, 'nx.json'), 'utf-8'));
}

function lintTemplate(html) {
  const eslintBin = resolve(ROOT, 'node_modules/eslint/bin/eslint.js');
  const args = [
    eslintBin,
    '--stdin',
    '--stdin-filename',
    'web/src/app/probe.component.html',
    '--format',
    'json',
  ];
  try {
    return JSON.parse(
      execFileSync(process.execPath, args, {
        cwd: ROOT,
        input: html,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    );
  } catch (error) {
    if (!error.stdout) throw error;
    return JSON.parse(error.stdout);
  }
}

/**
 * oxlint cannot load the Angular template parser, so the template rules run
 * through a separate ESLint target. #717 dropped them without any check going
 * red; this spec pins the pieces that bring them back.
 */
describe('Angular template lint wiring', () => {
  it('should infer lint-templates from the HTML-only ESLint plugin', () => {
    // given the Nx plugin registrations
    const plugins = nxJson().plugins;
    // when the ESLint plugin entry is resolved
    const eslintPlugin = plugins.find((p) => p.plugin === '@nx/eslint/plugin');
    // then it owns the lint-templates target and only looks at templates
    expect(eslintPlugin.options.targetName).toBe('lint-templates');
    expect(eslintPlugin.options.extensions).toEqual(['html']);
  });

  it('should make every lint run depend on lint-templates', () => {
    // given the target defaults
    const lintDefaults = nxJson().targetDefaults.lint;
    // then nx affected -t=lint pulls the template lint in
    expect(lintDefaults.dependsOn).toContain('lint-templates');
  });

  it('should run ESLint on staged templates and keep the hook serial', () => {
    // given the pre-commit wiring
    const hook = readFileSync(resolve(ROOT, '.husky/pre-commit'), 'utf-8');
    const lintStaged = readFileSync(
      resolve(ROOT, 'lint-staged.config.mjs'),
      'utf-8'
    );
    // then templates go through eslint and oxlint/oxfmt cannot race on a file
    expect(lintStaged).toMatch(/'\*\.html':\s*'eslint'/);
    expect(hook).toContain('lint-staged --concurrent false');
  });

  it('should fail a template that violates a recommended rule', () => {
    // given a template with the wrong banana-in-box syntax
    const [result] = lintTemplate('<div ([value])="model"></div>\n');
    // then ESLint reports it under the angular-eslint template rule
    expect(result.messages.map((m) => m.ruleId)).toContain(
      '@angular-eslint/template/banana-in-box'
    );
  });

  it('should fail a template that violates an accessibility rule', () => {
    // given an image without alternative text
    const [result] = lintTemplate('<img src="a.png" />\n');
    // then the accessibility rule set is active as well
    expect(result.messages.map((m) => m.ruleId)).toContain(
      '@angular-eslint/template/alt-text'
    );
  });

  it('should accept a clean template', () => {
    // given a template that follows the rules
    const [result] = lintTemplate('<img src="a.png" alt="Diagramm" />\n');
    // then nothing is reported
    expect(result.messages).toEqual([]);
  });
});
