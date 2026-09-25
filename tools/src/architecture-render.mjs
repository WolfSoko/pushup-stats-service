/**
 * Renders the metrics from `architecture-analysis.mjs` as Markdown with
 * Mermaid diagrams. Output is deterministic (no dates, stable ordering) so
 * an unchanged architecture produces an unchanged file and no diff.
 */
import { APP_SHELL, MAX_PROD_LOC } from './architecture-analysis.mjs';

const EDGE_ARROWS = { static: '-->', dynamic: '-.->', implicit: '==>' };

export function mermaidId(name) {
  return name.replace(/[^A-Za-z0-9_]/g, '_');
}

function scopeOf(node) {
  const scope = node.tags.find((tag) => tag.startsWith('scope:'));
  return scope ? scope.slice('scope:'.length) : node.name;
}

export function projectGraphMermaid(metrics) {
  const lines = ['flowchart TD'];
  for (const type of ['app', 'lib']) {
    const members = metrics.projects.filter((node) => node.type === type);
    if (members.length === 0) continue;
    lines.push(`  subgraph ${type}s["${type === 'app' ? 'Apps' : 'Libs'}"]`);
    for (const node of members) {
      const size = metrics.projectSizes[node.name];
      const detail = size ? `<br/>${size.files} Dateien · ${size.loc} LOC` : '';
      lines.push(
        `    ${mermaidId(node.name)}["${node.name}<br/><i>${scopeOf(node)}</i>${detail}"]`
      );
    }
    lines.push('  end');
  }
  for (const edge of metrics.projectEdges) {
    const arrow = EDGE_ARROWS[edge.type] ?? '-->';
    lines.push(
      `  ${mermaidId(edge.source)} ${arrow} ${mermaidId(edge.target)}`
    );
  }
  return lines.join('\n');
}

export function featureGraphMermaid(metrics) {
  const lines = ['flowchart LR'];
  const features = Object.keys(metrics.featureSizes);
  const cyclic = new Set(metrics.featureCycles.flat());
  for (const feature of features) {
    const size = metrics.featureSizes[feature];
    lines.push(
      `  ${mermaidId(feature)}["${feature}<br/>${size.files} Dateien · ${size.loc} LOC"]`
    );
  }
  for (const edge of metrics.featureEdges) {
    const label = edge.count > 1 ? `|${edge.count}|` : '';
    lines.push(
      `  ${mermaidId(edge.source)} -->${label} ${mermaidId(edge.target)}`
    );
  }
  lines.push('  classDef cyclic stroke:#d33,stroke-width:3px');
  const flagged = features.filter((feature) => cyclic.has(feature));
  if (flagged.length > 0) {
    lines.push(`  class ${flagged.map(mermaidId).join(',')} cyclic`);
  }
  return lines.join('\n');
}

function couplingTable(coupling, sizes) {
  const rows = Object.keys({ ...sizes, ...coupling })
    .sort()
    .map((name) => {
      const c = coupling[name] ?? { afferent: 0, efferent: 0, instability: 0 };
      const s = sizes[name] ?? { files: 0, loc: 0, oversized: 0 };
      return `| \`${name}\` | ${s.files} | ${s.loc} | ${s.oversized} | ${c.afferent} | ${c.efferent} | ${c.instability.toFixed(2)} |`;
    });
  return [
    '| Modul | Dateien | LOC | > ' +
      MAX_PROD_LOC +
      ' LOC | Ca (eingehend) | Ce (ausgehend) | Instabilität |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
  ].join('\n');
}

function cycleList(cycles) {
  if (cycles.length === 0) return '_Keine Zyklen._';
  return cycles
    .map((cycle) => `- ${cycle.map((n) => `\`${n}\``).join(' ↔ ')}`)
    .join('\n');
}

function oversizedList(files, max = 25) {
  if (files.length === 0) return `_Keine Prod-Datei über ${MAX_PROD_LOC} LOC._`;
  const shown = files.slice(0, max).map((f) => `| \`${f.path}\` | ${f.loc} |`);
  const more =
    files.length > max
      ? `\n\n…und ${files.length - max} weitere (siehe \`metrics.json\`).`
      : '';
  return ['| Datei | LOC |', '| --- | ---: |', ...shown].join('\n') + more;
}

export function renderDiagramsMarkdown(metrics) {
  return `# Architektur-Diagramme

> **Generiert** von \`pnpm nx run tools:generate-architecture-diagrams\` — nicht von Hand
> bearbeiten. Die wöchentliche Routine [\`architecture-review\`](../../.claude/routines/architecture-review.md)
> aktualisiert diese Datei und \`metrics.json\`; Regeln und Hintergründe stehen in
> [\`docs/architecture.md\`](../architecture.md).

## 1. Nx-Projekte

Pfeile: \`-->\` statischer Import, \`-.->\` dynamischer Import, \`==>\` implizite Abhängigkeit.

\`\`\`mermaid
${projectGraphMermaid(metrics)}
\`\`\`

### Kopplung der Projekte (statische Kanten)

${couplingTable(metrics.projectCoupling, metrics.projectSizes)}

### Zyklen zwischen Projekten

${cycleList(metrics.projectCycles)}

## 2. Feature-Bereiche in \`web/src/app\`

Jeder Knoten ist ein Ordner direkt unter \`web/src/app\` (\`${APP_SHELL}\` = Dateien direkt im
Ordner). Eine Kante zählt die Prod-Dateien des Quell-Features, die per relativem Import
in das Ziel-Feature greifen. Rot umrandet: Teil eines Import-Zyklus.

\`\`\`mermaid
${featureGraphMermaid(metrics)}
\`\`\`

### Kopplung der Feature-Bereiche

${couplingTable(metrics.featureCoupling, metrics.featureSizes)}

### Zyklen zwischen Feature-Bereichen

${cycleList(metrics.featureCycles)}

## 3. Prod-Dateien über ${MAX_PROD_LOC} LOC

${oversizedList(metrics.oversizedFiles)}
`;
}
