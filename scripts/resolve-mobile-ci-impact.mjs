import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoots = ['apps/mobile', 'packages/shared', 'packages/face-contracts'];
const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const shaPattern = /^[a-f0-9]{40}$/;
const hash = value => createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
class Unavailable extends Error {}
const unavailable = reason => { throw new Unavailable(reason); };
const git = args => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 });
const json = text => { try { return JSON.parse(text); } catch { unavailable('invalid-json'); } };
const readAt = (sha, file) => git(['show', `${sha}:${file}`]).toString();
const packageName = spec => spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
const withoutDependencies = record => Object.fromEntries(Object.entries(record).filter(([key]) => !dependencyFields.includes(key)));

export function rootDependencyDiff(raw) {
  const fields = raw.split('\0');
  if (fields.pop() !== '' || fields.length % 2) return false;
  return fields.length > 0 && fields.every((field, index) => index % 2 === 0
    ? field === 'M'
    : ['package.json', 'package-lock.json'].includes(field));
}

export function resolveLockPackage(packages, from, name) {
  let dir = from;
  for (;;) {
    if (path.posix.basename(dir) !== 'node_modules') {
      const candidate = path.posix.join(dir, 'node_modules', name);
      if (packages[candidate]) return candidate;
    }
    if (!dir || dir === '.') return null;
    dir = path.posix.dirname(dir);
    if (dir === '.') dir = '';
  }
}

export function lockClosure(lock, requests) {
  if (lock.lockfileVersion !== 3 || !lock.packages) unavailable('unsupported-lock');
  const records = new Map(), optionalMissing = [];
  const walk = key => {
    if (records.has(key)) return;
    const entry = lock.packages[key];
    if (!entry) unavailable('missing-lock-entry');
    records.set(key, entry);
    if (entry.link) {
      if (!sourceRoots.includes(entry.resolved)) unavailable('unsupported-workspace-source');
      walk(entry.resolved); return;
    }
    const groups = [entry.dependencies || {}, entry.optionalDependencies || {}, entry.peerDependencies || {}];
    if (!key.includes('node_modules/')) groups.push(entry.devDependencies || {});
    for (const group of groups) for (const name of Object.keys(group)) {
      const target = resolveLockPackage(lock.packages, key, name);
      if (target) walk(target);
      else if (entry.optionalDependencies?.[name] || entry.peerDependenciesMeta?.[name]?.optional) optionalMissing.push([key, name]);
      else unavailable('unresolved-lock-request');
    }
  };
  for (const root of sourceRoots) walk(root);
  for (const [from, name] of requests) {
    const target = resolveLockPackage(lock.packages, from, name);
    if (!target) unavailable('unresolved-source-import');
    walk(target);
  }
  // Sort record locations only. Preserve every record field and its original order.
  return { records: [...records].sort(([a], [b]) => a.localeCompare(b)), optionalMissing: optionalMissing.sort() };
}

export function compareEvidence(base, head) {
  for (const [field, reason] of [
    ['global', 'global-install-condition-changed'], ['imports', 'source-import-changed'],
    ['closure', 'mobile-resolution-changed'], ['native', 'native-discovery-changed'],
  ]) {
    if (!base[field] || !head[field]) return { impact: 'full-native', reason: 'incomplete-evidence' };
    if (hash(base[field]) !== hash(head[field])) return { impact: 'full-native', reason };
  }
  return { impact: 'no-mobile-impact', reason: 'matching-isolated-resolution', fingerprint: hash(base) };
}

export function scanSourceRequests(ts, sources) {
  const builtin = new Set(builtinModules.map(name => name.replace(/^node:/, '')));
  const requests = new Map();
  for (const [file, text] of sources) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    if (source.parseDiagnostics.length) unavailable('unsupported-source-syntax');
    const add = spec => {
      if (spec.startsWith('.')) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
        if (!sourceRoots.some(prefix => target.startsWith(prefix + '/'))) unavailable('external-relative-import');
        return;
      }
      if (spec.startsWith('node:') || builtin.has(spec)) unavailable('unsupported-node-module-import');
      if (!/^(@[a-z\d._-]+\/[a-z\d._-]+|[a-z\d._-]+)(\/.*)?$/i.test(spec)) unavailable('unsupported-import');
      const request = [path.posix.dirname(file), packageName(spec)];
      requests.set(JSON.stringify(request), request);
    };
    const visit = node => {
      if (ts.isIdentifier(node) && ['eval', 'Function', 'createRequire'].includes(node.text)) unavailable('dynamic-module-loader');
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        if (!ts.isStringLiteral(node.moduleSpecifier)) unavailable('dynamic-import');
        add(node.moduleSpecifier.text);
      }
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) add(node.argument.literal.text);
      if (ts.isIdentifier(node) && node.text === 'require'
        && !(ts.isCallExpression(node.parent) && node.parent.expression === node)
        && !(ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node && node.parent.name.text === 'resolve')) unavailable('aliased-module-loader');
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        if (!node.moduleReference.expression || !ts.isStringLiteral(node.moduleReference.expression)) unavailable('dynamic-import');
        add(node.moduleReference.expression.text);
      }
      if (ts.isCallExpression(node) && ['eval', 'Function', 'createRequire', 'module.require'].includes(node.expression.getText(source))) unavailable('dynamic-module-loader');
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ['require', 'require.resolve'].includes(node.expression.getText(source)))) {
        if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0])) unavailable('dynamic-import');
        add(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...requests.values()].sort(([a, b], [c, d]) => a.localeCompare(c) || b.localeCompare(d));
}
function importRequests(root, files) {
  const require = createRequire(path.join(root, 'package.json'));
  const sources = files.filter(file => sourceRoots.some(prefix => file.startsWith(prefix + '/')) && /\.[cm]?[jt]sx?$/.test(file))
    .map(file => [file, readFileSync(path.join(root, file), 'utf8')]);
  return scanSourceRequests(require('typescript'), sources);
}

function childEnv(emptyConfig) {
  const env = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'TEMP', 'TMP', 'LANG']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return { ...env, CI: '1', EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1',
    NPM_CONFIG_USERCONFIG: emptyConfig, NPM_CONFIG_GLOBALCONFIG: emptyConfig + '.global',
    NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_FUND: 'false' };
}
function child(command, args, cwd, env, timeout = 120000) {
  const result = spawnSync(command, args, { cwd, env, timeout, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) unavailable('isolated-command-failed');
  return result.stdout;
}
function npmCli() {
  const dir = path.dirname(process.execPath);
  const candidates = [path.join(dir, 'node_modules/npm/bin/npm-cli.js'), path.join(dir, '../lib/node_modules/npm/bin/npm-cli.js')];
  const found = candidates.find(existsSync);
  if (!found) unavailable('npm-cli-unavailable');
  return realpathSync(found);
}
export function normalizeSnapshotPaths(value, root) {
  if (typeof value === 'string') {
    for (const prefix of [root, root.replaceAll('\\', '/')]) {
      if (value === prefix || value.startsWith(prefix + '/') || value.startsWith(prefix + path.sep)) return '<snapshot>' + value.slice(prefix.length).replaceAll('\\', '/');
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(item => normalizeSnapshotPaths(item, root));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeSnapshotPaths(item, root)]));
  return value;
}
function nativeEvidence(root, env) {
  const mobile = path.join(root, 'apps/mobile');
  const linking = path.join(root, 'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js');
  const expo = path.join(root, 'node_modules/expo/bin/cli');
  const results = [];
  for (const [kind, platform] of [['resolve', 'android'], ['react-native-config', 'android'], ['resolve', 'apple'], ['react-native-config', 'ios']]) {
    results.push(json(child(process.execPath, [linking, kind, '--platform', platform, '--project-root', mobile, '--json'], root, env, 15000)));
  }
  results.push(json(child(process.execPath, [expo, 'config', '--type', 'public', '--json'], mobile, env, 15000)));
  if (results.some(result => !result || typeof result !== 'object' || Array.isArray(result))
    || [results[0], results[2]].some(result => !Array.isArray(result.modules) || result.modules.length === 0)
    || [results[1], results[3]].some(result => !result.dependencies || typeof result.dependencies !== 'object' || !result.project || typeof result.root !== 'string')
    || !results[4].name || !results[4].plugins) unavailable('unsupported-native-output');
  return normalizeSnapshotPaths(results, root);
}

function snapshot(sha, target) {
  const all = git(['ls-tree', '-r', '--name-only', '-z', sha]).toString().split('\0').filter(Boolean);
  if (all.some(file => /(^|\/)\.npmrc$/.test(file))) unavailable('project-npm-config');
  const files = all.filter(file => sourceRoots.some(root => file.startsWith(root + '/'))
    || ['package.json', 'package-lock.json'].includes(file) || /^(apps|packages|tools)\/[^/]+\/package\.json$/.test(file));
  const modes = new Map(git(['ls-tree', '-r', '-z', sha]).toString().split('\0').filter(Boolean).map(record => {
    const split = record.indexOf('\t');
    return [record.slice(split + 1), record.slice(0, 6)];
  }));
  for (const file of files) {
    if (!['100644', '100755'].includes(modes.get(file))) unavailable('unsupported-snapshot-kind');
    if (file.split('/').some(part => part.startsWith('.env') || part === '..')) unavailable('protected-snapshot-input');
    const dest = path.join(target, file);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, git(['show', `${sha}:${file}`]));
  }
  return files;
}
function installSafety(lock) {
  if (lock.lockfileVersion !== 3 || !lock.packages) unavailable('unsupported-lock');
  for (const entry of Object.values(lock.packages)) {
    if (entry.resolved && !entry.link) {
      const url = new URL(entry.resolved);
      if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org' || url.username || url.password) unavailable('unsupported-package-source');
    }
  }
}
function outsideChangesSafe(baseLock, headLock, baseRoot, headRoot) {
  const globals = lock => Object.fromEntries(Object.entries(lock).filter(([key]) => key !== 'packages'));
  if (hash(globals(baseLock)) !== hash(globals(headLock))) unavailable('lock-global-condition-changed');
  for (const key of new Set([...Object.keys(baseLock.packages), ...Object.keys(headLock.packages)])) {
    if (key === '') continue;
    const before = baseLock.packages[key], after = headLock.packages[key];
    if (hash(before) === hash(after)) continue;
    if ([before, after].some(entry => entry?.hasInstallScript || entry?.os || entry?.cpu || entry?.bin || entry?.link)) unavailable('conditional-or-install-change');
    for (const root of [baseRoot, headRoot]) {
      const dir = path.join(root, key);
      if (!existsSync(dir)) continue;
      const manifest = json(readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (manifest['react-native'] || manifest.expo || manifest.codegenConfig || manifest.bin
        || ['preinstall', 'install', 'postinstall'].some(name => manifest.scripts?.[name])
        || ['expo-module.config.json', 'react-native.config.js', 'react-native.config.cjs', 'react-native.config.mjs'].some(name => existsSync(path.join(dir, name)))) unavailable('changed-native-or-install-package');
    }
  }
}
export function isolatedEvidence(baseSha, headSha, prepareSnapshots) {
  const tempParent = realpathSync(os.tmpdir());
  const temp = mkdtempSync(path.join(tempParent, 'mobile-ci-impact-'));
  try {
    const base = path.join(temp, 'base'), head = path.join(temp, 'head');
    const files = [snapshot(baseSha, base), snapshot(headSha, head)];
    if (prepareSnapshots) prepareSnapshots(base, head);
    const packages = [base, head].map(root => json(readFileSync(path.join(root, 'package.json'), 'utf8')));
    const locks = [base, head].map(root => json(readFileSync(path.join(root, 'package-lock.json'), 'utf8')));
    const global = packages.map((pkg, index) => [withoutDependencies(pkg), withoutDependencies(locks[index].packages?.[''] || {})]);
    if (hash(global[0]) !== hash(global[1])) return { impact: 'full-native', reason: 'global-install-condition-changed' };
    if (JSON.stringify(packages[0].workspaces) !== JSON.stringify(['apps/*', 'packages/*', 'tools/*'])) unavailable('unsupported-workspaces');
    for (const [index, root] of [base, head].entries()) for (const file of files[index].filter(file => file.endsWith('/package.json') || file === 'package.json')) {
      const manifest = json(readFileSync(path.join(root, file), 'utf8'));
      if (['preinstall', 'install', 'postinstall', 'prepare'].some(name => manifest.scripts?.[name])) unavailable('workspace-install-hook');
    }
    locks.forEach(installSafety);
    const config = path.join(temp, 'empty.npmrc');
    writeFileSync(config, ''); writeFileSync(config + '.global', '');
    const env = childEnv(config);
    for (const root of [base, head]) child(process.execPath, [npmCli(), 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], root, env);
    const evidence = [base, head].map((root, index) => {
      const imports = importRequests(root, files[index]);
      return { global: global[index], imports, closure: lockClosure(locks[index], imports) };
    });
    const graph = compareEvidence({ ...evidence[0], native: {} }, { ...evidence[1], native: {} });
    if (graph.impact !== 'no-mobile-impact') return graph;
    outsideChangesSafe(locks[0], locks[1], base, head);
    for (const [index, root] of [base, head].entries()) evidence[index].native = nativeEvidence(root, env);
    return compareEvidence(evidence[0], evidence[1]);
  } finally {
    const resolved = realpathSync(temp);
    if (path.dirname(resolved) !== tempParent || !path.basename(resolved).startsWith('mobile-ci-impact-')) throw new Error('Unsafe temporary cleanup');
    rmSync(resolved, { recursive: true, force: true });
  }
}

export function shadowPlan({ event, base, candidate, diff, evidence }) {
  const plan = { event, base_sha: shaPattern.test(base || '') ? base : '', candidate_sha: candidate,
    shadow: true, run_android: true, run_ios: true, impact: 'full-native', reason: 'unsupported-event' };
  if (!shaPattern.test(candidate || '') || /^0+$/.test(candidate)) throw new Error('Invalid candidate SHA');
  if (event === 'workflow_dispatch') return { ...plan, reason: 'manual-full-native' };
  if (!['pull_request', 'push'].includes(event)) return plan;
  if (!shaPattern.test(base || '') || /^0+$/.test(base)) return { ...plan, reason: 'missing-base' };
  if (!rootDependencyDiff(diff)) return { ...plan, reason: 'source-or-unknown-change' };
  return { ...plan, ...(evidence || { reason: 'incomplete-evidence' }) };
}
export function verifySelectedJobs(platform, needs, expected) {
  const plan = needs['mobile-impact-plan'];
  if (!shaPattern.test(expected || '') || /^0+$/.test(expected) || plan?.result !== 'success' || plan.outputs?.candidate_sha !== expected
    || plan.outputs?.run_android !== 'true' || plan.outputs?.run_ios !== 'true' || plan.outputs?.shadow !== 'true') throw new Error('Missing or invalid impact plan');
  const selected = platform === 'android' ? ['android-debug-apk', 'native-shell-smoke', 'store-capture-20a', 'store-capture-20b']
    : platform === 'ios' ? ['ios-native-shell'] : null;
  if (!selected || selected.some(name => needs[name]?.result !== 'success')) throw new Error('Selected native verification failed or skipped');
  return true;
}
async function main() {
  if (process.argv[2] === 'verify') {
    verifySelectedJobs(process.argv[3], json(process.env.MOBILE_CI_NEEDS || ''), process.env.EXPECTED_SHA);
    console.log('MOBILE_CI_SELECTED_JOBS=PASS'); return;
  }
  if (process.argv.length > 2) throw new Error('Unsupported command');
  const candidate = process.env.EXPECTED_SHA;
  if (git(['rev-parse', 'HEAD']).toString().trim() !== candidate) throw new Error('Candidate checkout mismatch');
  const event = process.env.MOBILE_CI_EVENT, base = process.env.MOBILE_CI_BASE_SHA;
  let diff = '', evidence = { impact: 'full-native', reason: 'base-unavailable' };
  if (['pull_request', 'push'].includes(event) && shaPattern.test(base || '') && !/^0+$/.test(base)) {
    const exists = spawnSync('git', ['cat-file', '-e', `${base}^{commit}`]);
    if (exists.status === 0) {
      diff = git(['diff', '--no-renames', '--name-status', '-z', base, candidate]).toString();
      if (rootDependencyDiff(diff)) {
        try { evidence = isolatedEvidence(base, candidate); }
        catch (error) { if (!(error instanceof Unavailable)) throw error; evidence = { impact: 'full-native', reason: error.message }; }
      }
    }
  }
  const plan = shadowPlan({ event, base, candidate, diff, evidence });
  console.log(JSON.stringify(plan, null, 2));
  if (process.env.GITHUB_OUTPUT) for (const [key, value] of Object.entries(plan)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Mobile impact shadow plan\n\nAll native jobs remain selected. This is a dependency-impact observation, not a runtime PASS.\n\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
