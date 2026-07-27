import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const entry = path.join(root, 'js/sky-room.js');
const moduleRoot = path.join(root, 'js/sky-room');
const sourceRoots = ['js', 'server', 'scripts'].map(folder => path.join(root, folder));

const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
  const target = path.join(directory, item.name);
  return item.isDirectory() ? walk(target) : [target];
});

const sourceFiles = sourceRoots.flatMap(directory => walk(directory))
  .filter(file => /\.(?:js|mjs)$/.test(file));
const sourceByFile = new Map(sourceFiles.map(file => [file, fs.readFileSync(file, 'utf8')]));

const dependencySpecifiers = source => {
  const values = [];
  const patterns = [
    /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) values.push(match[1]);
  }
  return values;
};

const resolveDependency = (from, specifier) => {
  if (!specifier.startsWith('.')) return null;
  const clean = specifier.split(/[?#]/, 1)[0];
  const resolved = path.resolve(path.dirname(from), clean);
  return path.extname(resolved) ? resolved : `${resolved}.js`;
};

const reachable = new Set();
const pending = [entry];
while (pending.length) {
  const file = pending.pop();
  if (reachable.has(file)) continue;
  const source = sourceByFile.get(file);
  if (source == null) throw new Error(`Missing imported module: ${path.relative(root, file)}`);
  reachable.add(file);
  for (const specifier of dependencySpecifiers(source)) {
    const dependency = resolveDependency(file, specifier);
    if (dependency && dependency.startsWith(path.join(root, 'js'))) pending.push(dependency);
  }
}

const runtimeModules = walk(moduleRoot).filter(file => file.endsWith('.js'));
const unreachable = runtimeModules.filter(file => !reachable.has(file));

const combinedSource = [...sourceByFile.values()].join('\n');
const unreferencedExports = [];
const unusedImports = [];
for (const file of runtimeModules) {
  const source = sourceByFile.get(file);
  for (const match of source.matchAll(/\bexport\s+(?:const|let|class|function)\s+([A-Za-z_$][\w$]*)/g)) {
    const name = match[1];
    const occurrences = combinedSource.match(new RegExp(`\\b${name}\\b`, 'g'))?.length || 0;
    if (occurrences < 2) unreferencedExports.push(`${path.relative(root, file)}:${name}`);
  }
  for (const match of source.matchAll(/\bimport\s*{([^}]+)}\s*from\s*['"][^'"]+['"]/g)) {
    for (const specifier of match[1].split(',')) {
      const parts = specifier.trim().split(/\s+as\s+/);
      const localName = parts.at(-1)?.trim();
      if (!localName) continue;
      const occurrences = source.match(new RegExp(`\\b${localName}\\b`, 'g'))?.length || 0;
      if (occurrences < 2) unusedImports.push(`${path.relative(root, file)}:${localName}`);
    }
  }
}

if (unreachable.length || unreferencedExports.length || unusedImports.length) {
  if (unreachable.length) {
    console.error('Unreachable Sky Room modules:');
    unreachable.forEach(file => console.error(`- ${path.relative(root, file)}`));
  }
  if (unreferencedExports.length) {
    console.error('Unreferenced Sky Room exports:');
    unreferencedExports.forEach(value => console.error(`- ${value}`));
  }
  if (unusedImports.length) {
    console.error('Unused Sky Room imports:');
    unusedImports.forEach(value => console.error(`- ${value}`));
  }
  process.exitCode = 1;
} else {
  console.log(`Sky Room module reachability passed (${runtimeModules.length} modules, ${reachable.size} JS files reachable).`);
}
