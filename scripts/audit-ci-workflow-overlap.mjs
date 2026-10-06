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
const PHASE_C_EXECUTION_SEMANTICS_PATH = path.join(ROOT, "docs", "ci", "consolidation-audits", "phase-c-execution-semantics.json");
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

function scriptInvocations(commands) {
  const syntaxScripts = matches(
    commands,
    /node\s+--check\s+["']?((?:scripts|crawler\/scripts)\/[A-Za-z0-9_./-]+\.(?:mjs|js))["']?/g,
  );
  const withoutSyntax = commands.replace(
    /node\s+--check\s+["']?(?:scripts|crawler\/scripts)\/[A-Za-z0-9_./-]+\.(?:mjs|js)["']?/g,
    "",
  );
  const scripts = matches(
    withoutSyntax,
    /(?:^|[\s"'(])((?:scripts|crawler\/scripts)\/[A-Za-z0-9_./-]+\.(?:mjs|js|sh|py))/gm,
  );
  return { scripts, syntaxScripts };
}

function directCoverage(yaml, packageScripts) {
  const commands = runBlocks(yaml).join("\n");
  const directInvocations = scriptInvocations(commands);
  const npmScripts = matches(commands, /npm\s+(?:--prefix\s+[^\s]+\s+)?run\s+([A-Za-z0-9:_-]+)/g);
  const resolvedPackageScripts = [];
  const resolvedPackageSyntaxScripts = [];
  for (const name of npmScripts) {
    const command = packageScripts[name];
    if (!command) continue;
    const resolved = scriptInvocations(command);
    resolvedPackageScripts.push(...resolved.scripts);
    resolvedPackageSyntaxScripts.push(...resolved.syntaxScripts);
  }
  return {
    commands,
    scripts: [...new Set([...directInvocations.scripts, ...resolvedPackageScripts])].sort(),
    syntaxScripts: [...new Set([...directInvocations.syntaxScripts, ...resolvedPackageSyntaxScripts])].sort(),
    npmScripts,
  };
}


function jobBlocks(yaml) {
  const lines = yaml.split(/\r?\n/);
  const jobsIndex = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (jobsIndex < 0) return [];
  const starts = [];
  let jobsEnd = lines.length;
  for (let i = jobsIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() && indentOf(line) === 0) {
      jobsEnd = i;
      break;
    }
    const match = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (match) starts.push({ index: i, name: match[1] });
  }
  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : jobsEnd;
    return { name: start.name, text: lines.slice(start.index, end).join("\n") };
  });
}

function stepBlocks(jobText) {
  const lines = jobText.split(/\r?\n/);
  const stepsIndex = lines.findIndex((line) => /^    steps:\s*$/.test(line));
  if (stepsIndex < 0) return [];
  const starts = [];
  for (let i = stepsIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() && indentOf(line) <= 4) break;
    if (/^      -\s+/.test(line)) starts.push(i);
  }
  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : lines.length;
    return lines.slice(start, end).join("\n");
  });
}

function conditionOf(text, indent) {
  const prefix = " ".repeat(indent) + "if:";
  const line = text.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : "";
}

function isWorkflowDispatchOnly(condition) {
  if (!condition) return false;
  const normalized = condition
    .replace(/^\s*\$\{\{\s*/, "")
    .replace(/\s*\}\}\s*$/, "")
    .trim();
  return /^github\.event_name\s*==\s*['"]workflow_dispatch['"](?:\s*&&|\s*$)/.test(normalized);
}


function isPureScriptAlias(name, packageScripts) {
  const command = packageScripts[name]?.trim();
  if (!command) return false;
  if (/&&|\|\||;|\n/.test(command)) return false;
  const invocations = scriptInvocations(command);
  const count = invocations.scripts.length + invocations.syntaxScripts.length;
  if (count !== 1) return false;
  return /^(?:node(?:\s+--check)?|bash|sh|python3?|python)\s+/.test(command);
}

function normalizedPackagePrefix(prefix) {
  if (!prefix) return "";
  return prefix.replace(/^\.\//, "").replace(/\/$/, "");
}

function packageScriptsForPrefix(prefix) {
  const normalized = normalizedPackagePrefix(prefix);
  const packagePath = normalized ? path.join(ROOT, normalized, "package.json") : PACKAGE_PATH;
  if (!fs.existsSync(packagePath)) return {};
  return JSON.parse(fs.readFileSync(packagePath, "utf8")).scripts || {};
}

function scopedScriptPath(prefix, script) {
  const normalized = normalizedPackagePrefix(prefix);
  if (!normalized) return script;
  if (script.startsWith(normalized + "/")) return script;
  return path.posix.join(normalized, script);
}

function npmExecutionUnit(name, prefix) {
  const normalized = normalizedPackagePrefix(prefix);
  return normalized ? "npm:" + normalized + ":" + name : "npm:" + name;
}

function driverNpmInvocations(content) {
  const out = [];
  for (const match of content.matchAll(/\bnpm\s*,\s*\[\s*["']--prefix["']\s*,\s*["']([^"']+)["']\s*,\s*["']run["']\s*,\s*["']([A-Za-z0-9:_-]+)["']/g)) {
    out.push({ prefix: normalizedPackagePrefix(match[1]), name: match[2] });
  }
  for (const match of content.matchAll(/\bnpm\s*,\s*\[\s*["']run["']\s*,\s*["']([A-Za-z0-9:_-]+)["']/g)) {
    out.push({ prefix: "", name: match[1] });
  }
  const seen = new Set();
  return out.filter((item) => {
    const key = item.prefix + "::" + item.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function packageInvocationExecutionUnits(invocation) {
  const scripts = packageScriptsForPrefix(invocation.prefix);
  const command = scripts[invocation.name]?.trim();
  if (!command || !isPureScriptAlias(invocation.name, scripts)) {
    return [npmExecutionUnit(invocation.name, invocation.prefix)];
  }
  const resolved = scriptInvocations(command);
  const units = [];
  for (const script of resolved.scripts) {
    const scoped = scopedScriptPath(invocation.prefix, script);
    for (const expanded of expandDriverScripts([scoped])) units.push("script:" + expanded);
  }
  for (const script of resolved.syntaxScripts) {
    units.push("syntax:" + scopedScriptPath(invocation.prefix, script));
  }
  return [...new Set(units)].sort();
}

function expandDriverNpmUnits(initialScripts) {
  const units = new Set();
  for (const script of expandDriverScripts(initialScripts)) {
    const absolute = path.join(ROOT, script);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const content = fs.readFileSync(absolute, "utf8");
    if (!/(?:node:child_process|child_process)/.test(content) || !/spawnSync\s*\(/.test(content)) continue;
    for (const invocation of driverNpmInvocations(content)) {
      for (const unit of packageInvocationExecutionUnits(invocation)) units.add(unit);
    }
  }
  return [...units].sort();
}

function unitsForText(text, packageScripts) {
  const direct = directCoverage(text, packageScripts);
  const expandedScripts = expandDriverScripts(direct.scripts);
  const caps = capabilities(text, direct.commands);
  const npmUnits = direct.npmScripts
    .filter((name) => !isPureScriptAlias(name, packageScripts))
    .map((value) => "npm:" + value);
  const driverNpmUnits = expandDriverNpmUnits(direct.scripts);
  return [...new Set([
    ...expandedScripts.map((value) => "script:" + value),
    ...direct.syntaxScripts.map((value) => "syntax:" + value),
    ...npmUnits,
    ...driverNpmUnits,
    ...caps.map((value) => "capability:" + value),
  ])].sort();
}

function unitClass(unit) {
  if (unit.startsWith("syntax:")) return "syntax-verification";
  if (unit.startsWith("capability:")) return "infrastructure";
  if (unit.startsWith("script:")) {
    const script = unit.slice("script:".length);
    const base = path.posix.basename(script);
    if (/^(verify|check|audit|validate)-/.test(base) || /(?:^|-)guard(?:\.|-)/.test(base)) return "verification";
    if (/^(await|materialize|capture|configure|apply)-/.test(base)) return "execution-helper";
    return "execution-helper";
  }
  if (unit.startsWith("npm:")) {
    const name = unit.slice("npm:".length);
    if (/verify|check|lint|typecheck|guard/.test(name)) return "verification";
    if (/build|prebuild|export|config/.test(name)) return "build-tooling";
    return "execution-helper";
  }
  return "execution-helper";
}

function executionCoverage(yaml, packageScripts) {
  const events = topLevelOnEvents(yaml);
  const automaticEvents = new Set(["pull_request", "push"]);
  const hasAutomaticEvent = events.some((event) => automaticEvents.has(event));
  const hasDispatch = events.includes("workflow_dispatch");
  const automatic = new Set();
  const manualFallback = new Set();
  const manualOnly = new Set();

  for (const job of jobBlocks(yaml)) {
    const jobCondition = conditionOf(job.text, 4);
    for (const step of stepBlocks(job.text)) {
      const stepCondition = conditionOf(step, 8);
      const combinedCondition = [jobCondition, stepCondition].filter(Boolean).join(" && ");
      const units = unitsForText(step, packageScripts);
      if (isWorkflowDispatchOnly(combinedCondition)) {
        const target = hasAutomaticEvent && hasDispatch ? manualFallback : manualOnly;
        for (const unit of units) target.add(unit);
        continue;
      }
      if (hasAutomaticEvent) {
        for (const unit of units) automatic.add(unit);
      } else if (hasDispatch) {
        for (const unit of units) manualOnly.add(unit);
      }
    }
  }

  return {
    automaticExecutionUnits: [...automatic].sort(),
    manualFallbackUnits: [...manualFallback].sort(),
    manualOnlyExecutionUnits: [...manualOnly].sort(),
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
    if (!/(?:node:child_process|child_process)/.test(content) || !/spawnSync\s*\(/.test(content)) continue;
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
const phaseCExecutionSemantics = fs.existsSync(PHASE_C_EXECUTION_SEMANTICS_PATH)
  ? JSON.parse(fs.readFileSync(PHASE_C_EXECUTION_SEMANTICS_PATH, "utf8"))
  : null;
const delegatedCurrentMainScripts = new Set(
  (currentMainDelegationPolicy?.owners || [])
    .flatMap((owner) => owner.contracts || [])
    .flatMap((contract) => expandDriverScripts([contract.script]))
    .map((script) => `script:${script}`),
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
    ...direct.syntaxScripts.map((value) => `syntax:${value}`),
    ...direct.npmScripts.map((value) => `npm:${value}`),
    ...caps.map((value) => `capability:${value}`),
  ].sort();
  const execution = executionCoverage(yaml, packageScripts);
  if (workflow === "current-main-health.yml") {
    execution.automaticExecutionUnits = execution.automaticExecutionUnits.filter(
      (unit) => !delegatedCurrentMainScripts.has(unit),
    );
  }
  return {
    workflow,
    primaryResponsibility: entry.primaryResponsibility,
    watchtowerTrackBinding: entry.watchtowerTrackBinding,
    preservationPolicy: entry.preservationPolicy,
    lifecycleNameClass: entry.lifecycleNameClass,
    events: topLevelOnEvents(yaml),
    jobs: jobNames(yaml),
    directScripts: direct.scripts,
    syntaxScripts: direct.syntaxScripts,
    expandedScripts,
    npmScripts: direct.npmScripts,
    actions,
    secrets,
    capabilities: caps,
    coverageUnits: [...new Set(units)],
    automaticExecutionUnits: execution.automaticExecutionUnits,
    manualFallbackUnits: execution.manualFallbackUnits,
    manualOnlyExecutionUnits: execution.manualOnlyExecutionUnits,
  };
});

const registryNames = fs.readdirSync(REGISTRY_DIR)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.slice(0, -5))
  .sort();
assert.deepEqual(registryNames, actual, "workflow responsibility registry must match workflow inventory");

function ownersFor(unitKey) {
  const owners = new Map();
  for (const node of graph) {
    for (const unit of node[unitKey]) {
      if (!owners.has(unit)) owners.set(unit, []);
      owners.get(unit).push(node.workflow);
    }
  }
  return owners;
}

const unitOwners = ownersFor("coverageUnits");
const automaticUnitOwners = ownersFor("automaticExecutionUnits");
const manualFallbackUnitOwners = ownersFor("manualFallbackUnits");
const manualOnlyUnitOwners = ownersFor("manualOnlyExecutionUnits");

for (const node of graph) {
  node.uniqueCoverageUnits = node.coverageUnits.filter((unit) => unitOwners.get(unit)?.length === 1);
}

if (phaseCExecutionSemantics) {
  assert.equal(phaseCExecutionSemantics.schemaVersion, "bejewely-ci-execution-overlap-semantics-v1");
  assert.deepEqual(phaseCExecutionSemantics.automaticEvents, ["pull_request", "push"]);
  for (const workflow of phaseCExecutionSemantics.expectedManualFallbackWorkflows || []) {
    const node = graph.find((item) => item.workflow === workflow);
    assert.ok(node, workflow + ": Phase C manual-fallback workflow missing");
    assert.ok(node.manualFallbackUnits.length > 0, workflow + ": expected manual fallback coverage missing");
  }
}

const projectWide = new Set(["current-main-health.yml", "pie-prospective.yml"]);
// Baseline shim names are historical; current registry determines active protection.
const protectedShims = new Set(graph.filter((node) => node.preservationPolicy === "preserve-as-required-check-compatibility-shim-until-classic-protection-audited").map((node) => node.workflow));
const manualCompatibility = new Set(baseline.protectedCompatibilityShims);
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
  } else if (manualCompatibility.has(node.workflow)) {
    node.preliminaryDisposition = "MANUAL_ONLY_REVIEW";
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

for (const shim of manualCompatibility) {
  const node = graph.find((item) => item.workflow === shim);
  assert.ok(node, `${shim}: manual compatibility workflow missing`);
  assert.deepEqual(node.events, ["workflow_dispatch"], `${shim}: routine polling must stay retired`);
  assert.equal(node.preservationPolicy, "preserve-until-equivalence-proven", `${shim}: stale protected-shim policy`);
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
  executionSemanticsVersion: phaseCExecutionSemantics?.schemaVersion || null,
  approvedAddedWorkflows: [...approvedAddedWorkflows].sort(),
  approvedRetiredWorkflows: [...approvedRetiredWorkflows].sort(),
  protectedCompatibilityShims: [...protectedShims].sort(),
  graph,
  overlaps,
  automaticOverlaps: (() => {
    const pairs = [];
    for (let i = 0; i < graph.length; i += 1) {
      for (let j = i + 1; j < graph.length; j += 1) {
        const left = graph[i];
        const right = graph[j];
        const a = new Set(left.automaticExecutionUnits);
        const b = new Set(right.automaticExecutionUnits);
        const shared = [...a].filter((unit) => b.has(unit));
        if (!shared.length) continue;
        const union = new Set([...a, ...b]);
        const smaller = Math.max(1, Math.min(a.size, b.size));
        pairs.push({
          left: left.workflow,
          right: right.workflow,
          sharedUnits: shared.length,
          containment: Number((shared.length / smaller).toFixed(4)),
          jaccard: Number((shared.length / Math.max(1, union.size)).toFixed(4)),
          shared,
          projectWidePair: projectWide.has(left.workflow) || projectWide.has(right.workflow),
        });
      }
    }
    return pairs.sort((a, b) => b.containment - a.containment || b.sharedUnits - a.sharedUnits || b.jaccard - a.jaccard);
  })(),
  automaticDuplicateUnits: [...automaticUnitOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([unit, owners]) => ({ unit, class: unitClass(unit), owners: [...owners].sort() }))
    .sort((a, b) => b.owners.length - a.owners.length || a.unit.localeCompare(b.unit)),
  automaticVerificationDuplicateUnits: [...automaticUnitOwners.entries()]
    .filter(([unit, owners]) => owners.length > 1 && unitClass(unit) === "verification")
    .map(([unit, owners]) => ({ unit, owners: [...owners].sort() }))
    .sort((a, b) => b.owners.length - a.owners.length || a.unit.localeCompare(b.unit)),
  manualFallbackDuplicateUnits: [...manualFallbackUnitOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([unit, owners]) => ({ unit, owners: [...owners].sort() }))
    .sort((a, b) => b.owners.length - a.owners.length || a.unit.localeCompare(b.unit)),
};

if (args.has("--json")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const duplicateUnits = [...unitOwners.entries()].filter(([, owners]) => owners.length > 1);
  const automaticExecutionDuplicateUnits = [...automaticUnitOwners.entries()].filter(([, owners]) => owners.length > 1);
  const manualFallbackDuplicateUnits = [...manualFallbackUnitOwners.entries()].filter(([, owners]) => owners.length > 1);
  const automaticOverlaps = report.automaticOverlaps;
  console.log(
    `CI_WORKFLOW_OVERLAP_AUDIT workflows=${graph.length} duplicate_units=${duplicateUnits.length} execution_duplicate_units=${automaticExecutionDuplicateUnits.length} automatic_execution_duplicate_units=${automaticExecutionDuplicateUnits.length} automatic_verification_duplicate_units=${report.automaticVerificationDuplicateUnits.length} manual_fallback_units=${manualFallbackUnitOwners.size} manual_fallback_duplicate_units=${manualFallbackDuplicateUnits.length} manual_only_units=${manualOnlyUnitOwners.size} overlap_pairs=${overlaps.length} automatic_overlap_pairs=${automaticOverlaps.length}`,
  );
  console.log("Top coverage overlap pairs (evidence only; no automatic retirement):");
  for (const pair of overlaps.slice(0, 20)) {
    console.log(`- ${pair.left} <> ${pair.right}: containment=${pair.containment} shared=${pair.sharedUnits} projectWide=${pair.projectWidePair}`);
  }
  console.log("Top automatic execution overlap pairs:");
  for (const pair of automaticOverlaps.slice(0, 20)) {
    console.log(`- ${pair.left} <> ${pair.right}: containment=${pair.containment} shared=${pair.sharedUnits} projectWide=${pair.projectWidePair}`);
  }
  console.log("Top automatic duplicate units:");
  for (const item of report.automaticDuplicateUnits.slice(0, 20)) {
    console.log(`- ${item.unit}: class=${item.class} owners=${item.owners.length} [${item.owners.join(",")}]`);
  }
  console.log("Top automatic verification duplicate units:");
  for (const item of report.automaticVerificationDuplicateUnits.slice(0, 20)) {
    console.log(`- ${item.unit}: owners=${item.owners.length} [${item.owners.join(",")}]`);
  }
}

if (args.has("--check")) {
  console.log(`CI_WORKFLOW_OVERLAP_AUDIT=PASS workflows=${graph.length} baseline=${baseline.expectedWorkflowCount} phase_b=${Boolean(phaseBPolicy)} protected_shims=${protectedShims.size}`);
}
