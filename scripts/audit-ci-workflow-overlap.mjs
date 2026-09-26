#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW_DIR = path.join(ROOT, ".github", "workflows");
const REGISTRY_DIR = path.join(ROOT, "docs", "ci", "workflow-responsibilities");
const BASELINE_PATH = path.join(ROOT, "docs", "ci", "consolidation-audits", "phase-a-baseline.json");
const PHASE_B_POLICY_PATH = path.join(ROOT, "docs", "ci", "consolidation-audits", "phase-b-policy.json");
const CURRENT_MAIN_DELEGATION_POLICY_PATH = path.join(ROOT, "docs", "ci", "consolidation-audits", "current-main-delegation-policy.json");
const PACKAGE_PATH = path.join(ROOT, "package.json");
const args = new Set(process.argv.slice(2));

function indentOf(line) {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function runBlocks(yaml) {
  const lines = yaml.split(/\r?\n/);
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(\s*)run:\s*(.*)$/);
    if (!match) continue;
    const baseIndent = match[1].length;
    const tail = match[2].trim();
    if (tail && !["|", "|-", ">", ">-"].includes(tail)) {
      blocks.push(tail);
      continue;
    }
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() && indentOf(lines[j]) <= baseIndent) break;
      body.push(lines[j]);
      i = j;
    }
    blocks.push(body.join("\n"));
  }
  return blocks;
}

function topLevelOnEvents(yaml) {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => /^on:\s*$/.test(line));
  if (start < 0) return [];
  const events = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() && indentOf(line) === 0) break;
    const match = line.match(/^  ([A-Za-z0-9_-]+):/);
    if (match) events.push(match[1]);
  }
  return [...new Set(events)].sort();
}

function jobNames(yaml) {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (start < 0) return [];
  const jobs = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() && indentOf(line) === 0) break;
    const match = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (match) jobs.push(match[1]);
  }
  return jobs;
}

function matches(text, regex, group = 1) {
  return [...new Set([...text.matchAll(regex)].map((match) => match[group]))].sort();
}

function directCoverage(yaml, packageScripts) {
  const commands = runBlocks(yaml).join("\n");
  const scripts = matches(commands, /(?:^|[\s"'(])((?:scripts|crawler\/scripts)\/[A-Za-z0-9_./-]+\.(?:mjs|js|sh|py))/gm);
  const npmScripts = matches(commands, /npm\s+(?:--prefix\s+[^\s]+\s+)?run\s+([A-Za-z0-9:_-]+)/g);
  const resolvedPackageScripts = [];
  for (const name of npmScripts) {
    const command = packageScripts[name];
    if (!command) continue;
    resolvedPackageScripts.push(...matches(command, /((?:scripts|crawler\/scripts)\/[A-Za-z0-9_./-]+\.(?:mjs|js|sh|py))/g));
  }
  return {
    commands,
    scripts: [...new Set([...scripts, ...resolvedPackageScripts])].sort(),
    npmScripts,
  };
}

function expandDriverScripts(initialScripts) {
  const expanded = new Set(initialScripts);
  const queue = [...initialScripts].map((script) => ({ script, depth: 0 }));
  while (queue.length) {
    const { script, depth } = queue.shift();
    if (depth >= 2) continue;
    const absolute = path.join(ROOT, script);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const content = fs.readFileSync(absolute, "utf8");
    if (!/spawnSync|\brun\s*\(/.test(content)) continue;
    for (const child of matches(content, /["']((?:scripts|crawler\/scripts)\/[A-Za-z0-9_./-]+\.(?:mjs|js|sh|py))["']/g)) {
      if (!expanded.has(child)) {
        expanded.add(child);
        queue.push({ script: child, depth: depth + 1 });
      }
    }
  }
  return [...expanded].sort();
}

function capabilities(yaml, commands) {
  const text = `${yaml}\n${commands}`;
  const out = new Set();
  const tests = [
    ["android-emulator", /android-emulator-runner/i],
    ["android-debug-build", /mobile:build:android:debug|build:android:debug/i],
    ["android-release-build", /build:android:release|gradlew[^\n]*bundleRelease|gradlew[^\n]*assembleRelease/i],
    ["android-prebuild", /prebuild:android|mobile:prebuild:android/i],
    ["ios-prebuild", /prebuild:ios/i],
    ["supabase-runtime", /supabase@|supabase\s+(?:start|db\s+reset)/i],
    ["postgres-runtime", /\bpsql\b|postgresql:\/\//i],
    ["production-build", /npm\s+run\s+build\b/i],
    ["artifact-upload", /actions\/upload-artifact@/i],
    ["artifact-download", /actions\/download-artifact@/i],
    ["codeql", /github\/codeql-action\//i],
    ["secret-dependent", /secrets\.[A-Za-z0-9_]+/i],
    ["external-provider", /OPENAI_API_KEY|api\.openai\.com/i],
    ["browser-e2e", /playwright/i],
    ["vercel-runtime", /\bvercel\b/i],
  ];
  for (const [name, regex] of tests) if (regex.test(text)) out.add(name);
  return [...out].sort();
}

function registryEntry(workflow) {
  const file = path.join(REGISTRY_DIR, `${workflow}.json`);
  assert.ok(fs.existsSync(file), `${workflow}: responsibility fragment missing`);
  const entry = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(entry.workflow, workflow, `${workflow}: responsibility fragment identity drift`);
  return entry;
}

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
const packageScripts = packageJson.scripts || {};
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
const phaseBPolicy = fs.existsSync(PHASE_B_POLICY_PATH)
  ? JSON.parse(fs.readFileSync(PHASE_B_POLICY_PATH, "utf8"))
  : null;
const approvedAddedWorkflows = phaseBPolicy?.approvedAddedWorkflows || [];
const approvedRetiredWorkflows = phaseBPolicy?.approvedRetiredWorkflows || [];
const currentMainDelegationPolicy = fs.existsSync(CURRENT_MAIN_DELEGATION_POLICY_PATH)
  ? JSON.parse(fs.readFileSync(CURRENT_MAIN_DELEGATION_POLICY_PATH, "utf8"))
  : null;
const delegatedCurrentMainScripts = new Set(
  (currentMainDelegationPolicy?.owners || []).flatMap((owner) => owner.contracts || []).map((contract) => `script:${contract.script}`),
);
if (phaseBPolicy) {
  assert.equal(phaseBPolicy.baselineWorkflowCount, baseline.expectedWorkflowCount, "Phase B baseline workflow count drift");
  assert.equal(new Set(approvedAddedWorkflows).size, approvedAddedWorkflows.length, "Phase B added workflow list contains duplicates");
  assert.equal(new Set(approvedRetiredWorkflows).size, approvedRetiredWorkflows.length, "Phase B retired workflow list contains duplicates");
}
const actual = fs.readdirSync(WORKFLOW_DIR).filter((name) => /\.ya?ml$/i.test(name)).sort();
const expectedWorkflowCount = baseline.expectedWorkflowCount + approvedAddedWorkflows.length - approvedRetiredWorkflows.length;
assert.equal(actual.length, expectedWorkflowCount, "workflow count drift requires explicit Phase B policy review");
for (const workflow of approvedAddedWorkflows) {
  assert.ok(actual.includes(workflow), `${workflow}: approved Phase B workflow missing`);
}
for (const workflow of approvedRetiredWorkflows) {
  assert.ok(!actual.includes(workflow), `${workflow}: retired Phase B workflow still present`);
}

const graph = actual.map((workflow) => {
  const yaml = fs.readFileSync(path.join(WORKFLOW_DIR, workflow), "utf8");
  const direct = directCoverage(yaml, packageScripts);
  const expandedScripts = expandDriverScripts(direct.scripts);
  const entry = registryEntry(workflow);
  const actions = matches(yaml, /^\s*uses:\s*([^\s#]+)/gm);
  const secrets = matches(yaml, /secrets\.([A-Za-z0-9_]+)/g);
  const caps = capabilities(yaml, direct.commands);
  const units = [
    ...expandedScripts.map((value) => `script:${value}`),
    ...direct.npmScripts.map((value) => `npm:${value}`),
    ...caps.map((value) => `capability:${value}`),
  ].sort();
  return {
    workflow,
    primaryResponsibility: entry.primaryResponsibility,
    watchtowerTrackBinding: entry.watchtowerTrackBinding,
    preservationPolicy: entry.preservationPolicy,
    lifecycleNameClass: entry.lifecycleNameClass,
    events: topLevelOnEvents(yaml),
    jobs: jobNames(yaml),
    directScripts: direct.scripts,
    expandedScripts,
    npmScripts: direct.npmScripts,
    actions,
    secrets,
    capabilities: caps,
    coverageUnits: [...new Set(units)],
  };
});

const registryNames = fs.readdirSync(REGISTRY_DIR)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.slice(0, -5))
  .sort();
assert.deepEqual(registryNames, actual, "workflow responsibility registry must match workflow inventory");

const unitOwners = new Map();
for (const node of graph) {
  for (const unit of node.coverageUnits) {
    if (!unitOwners.has(unit)) unitOwners.set(unit, []);
    unitOwners.get(unit).push(node.workflow);
  }
}
for (const node of graph) {
  node.uniqueCoverageUnits = node.coverageUnits.filter((unit) => unitOwners.get(unit)?.length === 1);
}

const projectWide = new Set(["current-main-health.yml", "pie-prospective.yml"]);
const protectedShims = new Set(baseline.protectedCompatibilityShims);
const overlaps = [];
for (let i = 0; i < graph.length; i += 1) {
  for (let j = i + 1; j < graph.length; j += 1) {
    const left = graph[i];
    const right = graph[j];
    const a = new Set(left.coverageUnits);
    const b = new Set(right.coverageUnits);
    const shared = [...a].filter((unit) => b.has(unit));
    if (!shared.length) continue;
    const union = new Set([...a, ...b]);
    const smaller = Math.max(1, Math.min(a.size, b.size));
    const containment = shared.length / smaller;
    const jaccard = shared.length / Math.max(1, union.size);
    overlaps.push({
      left: left.workflow,
      right: right.workflow,
      sharedUnits: shared.length,
      containment: Number(containment.toFixed(4)),
      jaccard: Number(jaccard.toFixed(4)),
      shared,
      projectWidePair: projectWide.has(left.workflow) || projectWide.has(right.workflow),
    });
  }
}
overlaps.sort((a, b) => b.containment - a.containment || b.sharedUnits - a.sharedUnits || b.jaccard - a.jaccard);

for (const node of graph) {
  if (protectedShims.has(node.workflow)) {
    node.preliminaryDisposition = "COMPAT_SHIM";
  } else if (node.workflow === "mobile-android-runtime.yml") {
    node.preliminaryDisposition = "CANONICAL";
  } else if (projectWide.has(node.workflow)) {
    node.preliminaryDisposition = "PROJECT_WIDE_AUDIT";
  } else if (
    node.events.length === 1 &&
    node.events[0] === "workflow_dispatch" &&
    node.capabilities.some((value) => ["artifact-upload", "android-release-build", "ios-prebuild", "secret-dependent"].includes(value))
  ) {
    node.preliminaryDisposition = "MANUAL_ONLY_REVIEW";
  } else {
    node.preliminaryDisposition = "REVIEW";
  }
}

for (const shim of protectedShims) {
  const node = graph.find((item) => item.workflow === shim);
  assert.ok(node, `${shim}: protected compatibility shim missing`);
  assert.deepEqual(node.directScripts, ["scripts/await-mobile-android-runtime.mjs"], `${shim}: compatibility shim execution drift`);
  assert.ok(!node.capabilities.some((value) => ["android-emulator", "android-debug-build", "android-release-build"].includes(value)), `${shim}: heavy Android execution must stay retired`);
}

assert.ok(graph.every((node) => node.preliminaryDisposition !== "RETIRE"), "Phase A must not auto-retire workflows");
assert.ok(graph.every((node) => node.coverageUnits.length > 0 || node.actions.length > 0), "every workflow needs inspectable coverage evidence");

const report = {
  schemaVersion: "bejewely-ci-workflow-overlap-audit-v1",
  authoritySha: baseline.authoritySha,
  generatedFromWorkingTree: true,
  workflowCount: graph.length,
  baselineWorkflowCount: baseline.expectedWorkflowCount,
  phaseBPolicyActive: Boolean(phaseBPolicy),
  approvedAddedWorkflows: [...approvedAddedWorkflows].sort(),
  approvedRetiredWorkflows: [...approvedRetiredWorkflows].sort(),
  protectedCompatibilityShims: [...protectedShims].sort(),
  graph,
  overlaps,
};

if (args.has("--json")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const duplicateUnits = [...unitOwners.entries()].filter(([, owners]) => owners.length > 1);
  const executionDuplicateUnits = [...unitOwners.entries()].filter(([unit, owners]) => {
    const executionOwners = owners.filter((owner) => !(owner === "current-main-health.yml" && delegatedCurrentMainScripts.has(unit)));
    return executionOwners.length > 1;
  });
  console.log(`CI_WORKFLOW_OVERLAP_AUDIT workflows=${graph.length} duplicate_units=${duplicateUnits.length} execution_duplicate_units=${executionDuplicateUnits.length} overlap_pairs=${overlaps.length}`);
  console.log("Top overlap pairs (evidence only; no automatic retirement):");
  for (const pair of overlaps.slice(0, 20)) {
    console.log(`- ${pair.left} <> ${pair.right}: containment=${pair.containment} shared=${pair.sharedUnits} projectWide=${pair.projectWidePair}`);
  }
}

if (args.has("--check")) {
  console.log(`CI_WORKFLOW_OVERLAP_AUDIT=PASS workflows=${graph.length} baseline=${baseline.expectedWorkflowCount} phase_b=${Boolean(phaseBPolicy)} protected_shims=${protectedShims.size}`);
}
