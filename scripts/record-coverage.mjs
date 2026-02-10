import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const summaryPath = 'coverage/web/coverage-summary.json';
const outPath = 'COVERAGE.md';

if (!existsSync(summaryPath)) {
  console.error(`[coverage] Missing ${summaryPath}. Run web tests with --codeCoverage first.`);
  process.exit(1);
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const total = summary.total;

const row = `| ${new Date().toISOString()} | ${total.statements.pct}% | ${total.branches.pct}% | ${total.functions.pct}% | ${total.lines.pct}% |`;
const header = [
  '# Coverage History',
  '',
  '| Timestamp (UTC) | Statements | Branches | Functions | Lines |',
  '|---|---:|---:|---:|---:|',
].join('\n');

if (!existsSync(outPath)) {
  writeFileSync(outPath, `${header}\n${row}\n`, 'utf8');
  console.log(`[coverage] Created ${outPath}`);
  process.exit(0);
}

const current = readFileSync(outPath, 'utf8').trimEnd();
writeFileSync(outPath, `${current}\n${row}\n`, 'utf8');
console.log(`[coverage] Appended snapshot to ${outPath}`);
