import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW_DIR = path.join(ROOT, ".github", "workflows");
const MAP_PATH = path.join(ROOT, "docs", "ci", "workflow-responsibility-map.json");

const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
assert.equal(map.schemaVersion, "bejewely-ci-workflow-responsibility-v2");
assert.equal(map.producerContractVersion, "watchtower-v0.3.2");

assert.deepEqual(map.watchtowerProject, {
  name: "비주얼리",
  key: "visualy",
  repository: "gycha0109-beep/K_beauty",
  canonicalTrackKeys: ["ops", "taxonomy-ai", "trust", "face-research", "full-report", "mobile"],
  projectWideWorkflows: ["current-main-health.yml", "pie-prospective.yml"],
  producerContract: "dedicated-static-run-name; shared-dynamic-marker; project-wide-unassigned",
});

const actual = fs.readdirSync(WORKFLOW_DIR)
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();
const declared = Object.keys(map.workflows || {}).sort();
const workflowInventoryDigest = crypto
  .createHash("sha256")
  .update(`${actual.join("\\n")}\\n`)
  .digest("hex");

assert.deepEqual(
  declared,
  actual,
  "CI workflow responsibility map must exactly match .github/workflows"
);
assert.equal(
  map.workflowInventoryDigest,
  `sha256:${workflowInventoryDigest}`,
  "workflowInventoryDigest must match the exact sorted workflow inventory",
);
assert.ok(
  !Object.hasOwn(map, "generatedFromMainSha"),
  "commit-derived responsibility-map provenance must stay retired",
);

const allowed = new Set(map.allowedPrimaryResponsibilities || []);
assert.ok(allowed.size > 0, "allowedPrimaryResponsibilities must not be empty");

const requiredCheckCompatibilityShims = new Set([
  "mobile-native-shell.yml",
  "mobile-20a-store-capture.yml",
  "mobile-20b-store-capture.yml",
]);

for (const name of actual) {
  const entry = map.workflows[name];
  assert.ok(entry && typeof entry === "object", `${name}: responsibility entry missing`);
  assert.ok(allowed.has(entry.primaryResponsibility), `${name}: invalid primaryResponsibility`);
  assert.ok(Array.isArray(entry.capabilities) && entry.capabilities.length > 0, `${name}: capabilities required`);
  const expectedPreservationPolicy =
    name === "mobile-android-runtime.yml"
      ? "canonical-owner"
      : requiredCheckCompatibilityShims.has(name)
        ? "preserve-as-required-check-compatibility-shim-until-classic-protection-audited"
        : "preserve-until-equivalence-proven";
  assert.equal(entry.preservationPolicy, expectedPreservationPolicy, `${name}: preservation policy drift`);

  const staticTrackByResponsibility = {
    "product-query-ai": "taxonomy-ai",
    "catalog-taxonomy": "taxonomy-ai",
    "face-lab": "face-research",
    "trust-data-governance": "trust",
    "mobile-client": "mobile",
    "mobile-api-integration": "mobile",
    "mobile-native": "mobile",
    "mobile-build": "mobile",
    "mobile-e2e": "mobile",
    "mobile-release-store": "mobile",
  };

  if (entry.primaryResponsibility === "global-governance") {
    assert.equal(entry.watchtowerTrackBinding, "unassigned-by-design", `${name}: global workflow must remain unassigned`);
  } else if (staticTrackByResponsibility[entry.primaryResponsibility]) {
    assert.equal(
      entry.watchtowerTrackBinding,
      `static:${staticTrackByResponsibility[entry.primaryResponsibility]}`,
      `${name}: dedicated workflow must use its canonical static Track Key`,
    );
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
