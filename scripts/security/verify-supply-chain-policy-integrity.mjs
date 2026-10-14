#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

// This is a policy-integrity regression test, NOT a vulnerability remediation.
// The canonical npm audit gate remains authoritative and must still fail if
// the installed vulnerable packages or expired exceptions remain unresolved.
function verify(audit, workflow) {
  const exceptions = audit.match(/const TEMPORARY_ADVISORY_EXCEPTIONS\s*=\s*Object\.freeze\(\[([\s\S]*?)\n\]\);/)?.[1];
  assert.ok(exceptions, "advisory exception declarations missing");
  assert.equal((exceptions.match(/\bid:\s*"GHSA-/g) || []).length, 2, "exception set changed");
  for (const [id, pkg, version, expiry] of [
    ["GHSA-vfj7-8cjw-p6xm", "braces", "3.0.3", "2026-10-10T00:00:00.000Z"],
    ["GHSA-86w9-cpqp-85rv", "node-forge", "1.4.0", "2026-10-16T00:00:00.000Z"],
  ]) {
    const start = exceptions.indexOf(`id: "${id}"`);
    assert.notEqual(start, -1, `${id}: exception identity missing`);
    const entry = exceptions.slice(start, exceptions.indexOf("propagatedHighPackages", start));
    assert.ok(entry.includes(`package: "${pkg}"`), `${id}: package identity changed`);
    assert.ok(entry.includes(`lockedVersion: "${version}"`), `${id}: lock identity changed`);
    assert.ok(entry.includes(`expiresAt: "${expiry}"`), `${id}: expiry changed`);
  }

  const baseline = audit.match(/const BASELINE\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\);/)?.[1];
  assert.ok(baseline, "vulnerability baseline missing");
  for (const severity of ["high", "critical"]) {
    const values = [...baseline.matchAll(new RegExp(`\\b${severity}:\\s*(\\d+)`, "g"))].map(x => Number(x[1]));
    assert.deepEqual(values, [0, 0], `${severity}: baseline relaxed`);
  }
  for (const [pattern, reason] of [
    [/spawnSync\(npm,\s*\["audit",\s*"--json",\s*\.\.\.args\]/, "npm audit JSON missing"],
    [/runAudit\("production",\s*\["--omit=dev"\]\)/, "production audit missing"],
    [/runAudit\("all",\s*\[\]\)/, "full audit missing"],
    [/Date\.now\(\)\s*<\s*expiry/, "expiry fail-close missing"],
    [/validateTemporaryAdvisoryExceptions\(\s*"production"/, "production advisory validator missing"],
    [/validateTemporaryAdvisoryExceptions\("all"/, "full advisory validator missing"],
    [/assertNoRegression\(\s*"production"/, "production baseline gate missing"],
    [/assertNoRegression\(\s*"all"/, "full baseline gate missing"],
  ]) assert.match(audit, pattern, reason);

  assert.match(workflow, /npm ci --ignore-scripts --no-audit --no-fund/, "lockfile install gate missing");
  assert.match(workflow, /run:\s*node scripts\/verify-supply-chain-audit\.mjs/, "canonical audit step missing");
  assert.match(workflow, /uses:\s*github\/codeql-action\/analyze@v4/, "CodeQL step missing");
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/m, "failure suppression forbidden");
  assert.doesNotMatch(workflow, /^\s*if\s*:/m, "conditional security skip requires separate review");
}

const audit = fs.readFileSync("scripts/verify-supply-chain-audit.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/supply-chain-security.yml", "utf8");
verify(audit, workflow);

function mutate(source, from, to) {
  assert.ok(source.includes(from), `test anchor missing: ${from}`);
  return source.replace(from, to);
}
function reject(label, alteredAudit, alteredWorkflow) {
  assert.throws(() => verify(alteredAudit, alteredWorkflow), undefined, label);
}
reject("braces expiry extension", mutate(audit, "2026-10-10T00:00:00.000Z", "2026-11-10T00:00:00.000Z"), workflow);
reject("node-forge expiry extension", mutate(audit, "2026-10-16T00:00:00.000Z", "2026-11-16T00:00:00.000Z"), workflow);
reject("expiry bypass", mutate(audit, "Date.now() < expiry", "true"), workflow);
reject("high baseline relaxation", mutate(audit, "high: 0,", "high: 1,"), workflow);
reject("production audit removal", mutate(audit, '["--omit=dev"]', "[]"), workflow);
reject("npm JSON audit removal", mutate(audit, '["audit", "--json", ...args]', '["audit", ...args]'), workflow);
reject("canonical audit step removal", audit, mutate(workflow, "run: node scripts/verify-supply-chain-audit.mjs", "run: echo skipped"));
reject("CodeQL removal", audit, mutate(workflow, "uses: github/codeql-action/analyze@v4", "run: echo skipped"));
reject("failure suppression", audit, workflow + "\ncontinue-on-error: true\n");

console.log("SUPPLY_CHAIN_POLICY_INTEGRITY=PASS mutation-cases=9");
console.log("VULNERABILITY_REMEDIATION=NOT_ATTESTED canonical-audit-remains-authoritative");
