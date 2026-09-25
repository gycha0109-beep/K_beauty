import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW_DIR = path.join(ROOT, ".github", "workflows");
const MAP_PATH = path.join(ROOT, "docs", "ci", "workflow-responsibility-map.json");

const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
assert.equal(map.schemaVersion, "bejewely-ci-workflow-responsibility-v3");
assert.equal(map.producerContractVersion, "watchtower-v0.3.2");
assert.ok(!Object.hasOwn(map, "workflowInventoryDigest"), "committed workflowInventoryDigest must stay retired");
assert.ok(!Object.hasOwn(map, "workflows"), "monolithic workflows map must stay retired");
assert.ok(!Object.hasOwn(map, "generatedFromMainSha"), "commit-derived responsibility-map provenance must stay retired");

assert.deepEqual(map.watchtowerProject, {
  name: "비주얼리",
  key: "visualy",
  repository: "gycha0109-beep/K_beauty",
  canonicalTrackKeys: ["ops", "taxonomy-ai", "trust", "face-research", "full-report", "mobile"],
  projectWideWorkflows: ["current-main-health.yml", "pie-prospective.yml"],
  producerContract: "dedicated-static-run-name; shared-dynamic-marker; project-wide-unassigned",
});

assert.deepEqual(map.workflowRegistry, {
  directory: "docs/ci/workflow-responsibilities",
  format: "one-json-file-per-workflow-v1",
  entryFile: "<workflow-file-name>.json",
  invariant: "Registry filenames and entry.workflow values must exactly match .github/workflows; inventory digests are computed at verification time and are not committed.",
});

const actual = fs.readdirSync(WORKFLOW_DIR)
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();

const registryDir = path.join(ROOT, map.workflowRegistry.directory);
const registryFiles = fs.readdirSync(registryDir)
  .filter((name) => name.endsWith(".json"))
  .sort();
const registry = new Map();

for (const file of registryFiles) {
  const entry = JSON.parse(fs.readFileSync(path.join(registryDir, file), "utf8"));
  assert.equal(typeof entry.workflow, "string", `${file}: workflow required`);
  assert.equal(file, `${entry.workflow}.json`, `${file}: filename must equal <workflow>.json`);
  assert.ok(!registry.has(entry.workflow), `${entry.workflow}: duplicate registry entry`);
  assert.deepEqual(
    Object.keys(entry).sort(),
    ["capabilities", "lifecycleNameClass", "preservationPolicy", "primaryResponsibility", "watchtowerTrackBinding", "workflow"].sort(),
    `${entry.workflow}: unexpected registry fields`,
  );
  registry.set(entry.workflow, entry);
}

const declared = [...registry.keys()].sort();
assert.deepEqual(
  declared,
  actual,
  "CI workflow responsibility registry must exactly match .github/workflows; add/remove the matching per-workflow JSON fragment",
);

const allowed = new Set(map.allowedPrimaryResponsibilities || []);
assert.ok(allowed.size > 0, "allowedPrimaryResponsibilities must not be empty");

const requiredCheckCompatibilityShims = new Set([
  "mobile-native-shell.yml",
  "mobile-20a-store-capture.yml",
  "mobile-20b-store-capture.yml",
]);

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

for (const name of actual) {
  const entry = registry.get(name);
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

console.log(`CI_WORKFLOW_RESPONSIBILITY_MAP=PASS workflows=${actual.length} registry=per-workflow-v1`);
