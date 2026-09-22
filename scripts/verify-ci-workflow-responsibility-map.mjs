import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW_DIR = path.join(ROOT, ".github", "workflows");
const MAP_PATH = path.join(ROOT, "docs", "ci", "workflow-responsibility-map.json");

const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
assert.equal(map.schemaVersion, "bejewely-ci-workflow-responsibility-v1");

const actual = fs.readdirSync(WORKFLOW_DIR)
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();
const declared = Object.keys(map.workflows || {}).sort();

assert.deepEqual(
  declared,
  actual,
  "CI workflow responsibility map must exactly match .github/workflows"
);

const allowed = new Set(map.allowedPrimaryResponsibilities || []);
assert.ok(allowed.size > 0, "allowedPrimaryResponsibilities must not be empty");

for (const name of actual) {
  const entry = map.workflows[name];
  assert.ok(entry && typeof entry === "object", `${name}: responsibility entry missing`);
  assert.ok(allowed.has(entry.primaryResponsibility), `${name}: invalid primaryResponsibility`);
  assert.ok(Array.isArray(entry.capabilities) && entry.capabilities.length > 0, `${name}: capabilities required`);
  assert.equal(entry.preservationPolicy, "preserve-until-equivalence-proven", `${name}: preservation policy drift`);

  if (entry.primaryResponsibility === "global-governance") {
    assert.equal(entry.watchtowerTrackBinding, "unassigned-by-design", `${name}: global workflow must remain unassigned`);
  } else {
    assert.equal(entry.watchtowerTrackBinding, "dynamic-by-run", `${name}: shared workflow must use dynamic run attribution`);
  }
}

for (const [name, responsibility] of Object.entries(map.embeddedResponsibilities || {})) {
  for (const script of responsibility.scripts || []) {
    assert.ok(fs.existsSync(path.join(ROOT, script)), `${name}: missing embedded responsibility asset ${script}`);
  }
}

console.log(`CI_WORKFLOW_RESPONSIBILITY_MAP=PASS workflows=${actual.length}`);
