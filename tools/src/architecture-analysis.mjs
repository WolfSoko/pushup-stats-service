/**
 * Modularity metrics for the architecture diagrams. Pure: callers pass the
 * Nx project graph and the source files in, nothing here touches the disk,
 * so every decision is testable.
 */
import { posix } from 'node:path';
import ts from 'typescript';

export const MAX_PROD_LOC = 250;
export const WEB_APP_ROOT = 'web/src/app';
export const APP_SHELL = 'app-shell';

const NON_PROD_RE =
  /(\.spec\.ts|\.test\.ts|\.generated\.ts|\.catalog\.ts|-content\.ts|test-setup\.ts)$/;
export function isProdSource(path) {
  return (
    path.endsWith('.ts') &&
    !NON_PROD_RE.test(path) &&
    !path.includes('/generated/') &&
    !/(^|\/)(web-e2e[^/]*|e2e|testing)\//.test(path)
  );
}

export function countLines(content) {
  if (content === '') return 0;
  return content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
}

export function projectNodes(graph) {
  return Object.values(graph.nodes)
    .map((node) => ({
      name: node.name,
      type: node.type,
      root: node.data.root,
      tags: [...(node.data.tags ?? [])].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function projectEdges(graph) {
  const names = new Set(Object.keys(graph.nodes));
  const edges = [];
  for (const [source, deps] of Object.entries(graph.dependencies)) {
    if (!names.has(source)) continue;
    for (const dep of deps) {
      if (!names.has(dep.target)) continue;
      edges.push({ source, target: dep.target, type: dep.type });
    }
  }
  return edges.sort(
    (a, b) =>
      a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
  );
}

export function projectOfFile(path, nodes) {
  let best = null;
  for (const node of nodes) {
    if (node.root === '.' || !path.startsWith(`${node.root}/`)) continue;
    if (!best || node.root.length > best.root.length) best = node;
  }
  return best?.name ?? null;
}

export function featureOfFile(path) {
  if (!path.startsWith(`${WEB_APP_ROOT}/`)) return null;
  const rest = path.slice(WEB_APP_ROOT.length + 1);
  return rest.includes('/') ? rest.split('/')[0] : APP_SHELL;
}

function featureOfImport(resolved, features) {
  if (!resolved.startsWith(`${WEB_APP_ROOT}/`)) return null;
  const head = resolved.slice(WEB_APP_ROOT.length + 1).split('/')[0];
  return features.has(head) ? head : APP_SHELL;
}

export function relativeImports(content) {
  const { importedFiles } = ts.preProcessFile(content, true, true);
  return [
    ...new Set(
      importedFiles
        .map((file) => file.fileName)
        .filter((spec) => spec.startsWith('.'))
    ),
  ];
}

/** Counts, per ordered feature pair, how many files of `source` import `target`. */
export function featureImportEdges(files) {
  const features = new Set(
    files.map((file) => featureOfFile(file.path)).filter(Boolean)
  );
  const counts = new Map();
  for (const file of files) {
    if (!isProdSource(file.path)) continue;
    const source = featureOfFile(file.path);
    if (!source) continue;
    const targets = new Set();
    for (const spec of relativeImports(file.content)) {
      const resolved = posix.normalize(
        posix.join(posix.dirname(file.path), spec)
      );
      const target = featureOfImport(resolved, features);
      if (target && target !== source) targets.add(target);
    }
    for (const target of targets) {
      const key = `${source}\u0000${target}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [source, target] = key.split('\u0000');
      return { source, target, count };
    })
    .sort(
      (a, b) =>
        a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
    );
}

/** Strongly connected components with more than one member (Tarjan). */
export function findCycles(edges) {
  const adjacency = new Map();
  for (const { source, target } of edges) {
    if (!adjacency.has(source)) adjacency.set(source, []);
    if (!adjacency.has(target)) adjacency.set(target, []);
    adjacency.get(source).push(target);
  }
  let index = 0;
  const indices = new Map();
  const lowlinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  const visit = (node) => {
    indices.set(node, index);
    lowlinks.set(node, index);
    index++;
    stack.push(node);
    onStack.add(node);
    for (const next of adjacency.get(node)) {
      if (!indices.has(next)) {
        visit(next);
        lowlinks.set(node, Math.min(lowlinks.get(node), lowlinks.get(next)));
      } else if (onStack.has(next)) {
        lowlinks.set(node, Math.min(lowlinks.get(node), indices.get(next)));
      }
    }
    if (lowlinks.get(node) !== indices.get(node)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    if (component.length > 1)
      components.push(component.sort((a, b) => a.localeCompare(b)));
  };

  for (const node of [...adjacency.keys()].sort((a, b) => a.localeCompare(b))) {
    if (!indices.has(node)) visit(node);
  }
  return components.sort((a, b) => a[0].localeCompare(b[0]));
}

export function sizeByGroup(files, groupOf) {
  const groups = new Map();
  for (const file of files) {
    if (!isProdSource(file.path)) continue;
    const group = groupOf(file.path);
    if (!group) continue;
    const entry = groups.get(group) ?? { files: 0, loc: 0, oversized: 0 };
    const loc = countLines(file.content);
    entry.files++;
    entry.loc += loc;
    if (loc > MAX_PROD_LOC) entry.oversized++;
    groups.set(group, entry);
  }
  return Object.fromEntries(
    [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  );
}

export function oversizedFiles(files, limit = MAX_PROD_LOC) {
  return files
    .filter((file) => isProdSource(file.path))
    .map((file) => ({ path: file.path, loc: countLines(file.content) }))
    .filter((file) => file.loc > limit)
    .sort((a, b) => b.loc - a.loc || a.path.localeCompare(b.path));
}

/** Instability I = Ce / (Ca + Ce) per node (Robert C. Martin). */
export function coupling(edges) {
  const stats = new Map();
  const entry = (name) => {
    if (!stats.has(name)) stats.set(name, { afferent: 0, efferent: 0 });
    return stats.get(name);
  };
  for (const { source, target } of edges) {
    entry(source).efferent++;
    entry(target).afferent++;
  }
  return Object.fromEntries(
    [...stats.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, { afferent, efferent }]) => [
        name,
        {
          afferent,
          efferent,
          instability:
            afferent + efferent === 0
              ? 0
              : Math.round((efferent / (afferent + efferent)) * 100) / 100,
        },
      ])
  );
}

export function buildMetrics(graph, files) {
  const nodes = projectNodes(graph);
  const edges = projectEdges(graph);
  const featureEdges = featureImportEdges(files);
  const staticEdges = edges.filter((edge) => edge.type === 'static');
  return {
    projects: nodes,
    projectEdges: edges,
    projectCycles: findCycles(staticEdges),
    projectCoupling: coupling(staticEdges),
    projectSizes: sizeByGroup(files, (path) => projectOfFile(path, nodes)),
    featureEdges,
    featureCycles: findCycles(featureEdges),
    featureCoupling: coupling(featureEdges),
    featureSizes: sizeByGroup(files, featureOfFile),
    oversizedFiles: oversizedFiles(files),
  };
}
