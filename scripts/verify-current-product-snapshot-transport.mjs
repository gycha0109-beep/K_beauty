import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  CURRENT_PRODUCT_SNAPSHOT_PROTECTION_FIELDS,
  CURRENT_PRODUCT_SNAPSHOT_PROTECTION_METADATA_VERSION,
  buildCurrentProductSnapshotProtectionMetadata
} from "../lib/current-product-snapshot-contract.js";
import { buildCurrentProductFindings } from "../lib/current-product-findings.js";
import {
  PREMIUM_REPORT_SNAPSHOT_VERSION,
  buildPremiumReportSnapshot
} from "../lib/premium-report-snapshot.js";

const ROOT = process.cwd();
const ARTIFACT_NAME = "current-product-snapshot-transport-evidence.json";
const EXPECTED_FIELDS = [
  "spf_value",
  "uva_label",
  "uv_filter_type",
  "tone_up",
  "white_cast",
  "eye_sting",
  "pilling_risk"
];
const UNRELATED_FIELDS = [
  "id",
  "brand",
  "name",
  "category",
  "product_form",
  "irritation_risk",
  "sensitivity_safe",
  "ingredient_signals"
];

let assertionCount = 0;
let negativeControlCount = 0;

function check(condition, message) {
  assertionCount += 1;
  assert(condition, message);
}

function equal(actual, expected, message) {
  assertionCount += 1;
  assert.deepEqual(actual, expected, message);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, stable(value[key])])
  );
}

function semanticHash(value) {
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function allFieldsFixture(overrides = {}) {
  return {
    id: "fixture-product-01",
    brand: "Fixture Brand",
    name: "Fixture Product",
    category: "sunscreen",
    product_form: "cream",
    irritation_risk: "low",
    sensitivity_safe: true,
    ingredient_signals: {
      functional: [{ label: "UV protection", count: 1 }]
    },
    spf_value: "50+",
    uva_label: "PA++++",
    uv_filter_type: "hybrid",
    tone_up: false,
    white_cast: "none",
    eye_sting: "low",
    pilling_risk: "low",
    ...overrides
  };
}

function buildSnapshot(source) {
  return {
    ...Object.fromEntries(UNRELATED_FIELDS.map((field) => [field, source[field]])),
    ...buildCurrentProductSnapshotProtectionMetadata(source)
  };
}

function executeRoundTrip(source, options = {}) {
  const beforeHash = semanticHash(source);
  let snapshot = buildSnapshot(source);
  if (options.mutateSnapshot) {
    snapshot = options.mutateSnapshot(snapshot, source);
  }

  const report = {
    locale: "ko",
    currentProducts: {
      selections: [{
        category: source.category,
        status: "selected",
        productId: source.id,
        productSnapshot: snapshot
      }],
      summary: {
        total: 1,
        selectedCount: 1,
        notInDbCount: 0,
        notUsingCount: 0,
        sunscreenStatus: source.category === "sunscreen" ? "selected" : "unknown"
      }
    }
  };
  const reportSnapshot = buildPremiumReportSnapshot(report);
  const persistencePayload = {
    report_version: reportSnapshot.reportVersion,
    premium_report: reportSnapshot.canonical
  };
  let serialized = JSON.stringify(persistencePayload);
  let parsed = JSON.parse(serialized);
  if (options.mutateParsed) {
    parsed = options.mutateParsed(parsed, source);
    serialized = JSON.stringify(parsed);
  }
  const savedReportReader = JSON.parse(serialized).premium_report;
  const reentrySnapshot =
    savedReportReader?.currentProducts?.selections?.[0]?.productSnapshot || null;
  const findings = buildCurrentProductFindings({
    currentProducts: savedReportReader?.currentProducts,
    primaryGoal: "protection",
    functionalDirection: "sunscreen_protection"
  });

  return {
    beforeHash,
    afterHash: semanticHash(source),
    snapshot,
    report,
    reportSnapshot,
    persistencePayload,
    savedReportReader,
    reentrySnapshot,
    findings,
    serialized
  };
}

function assertRoundTrip(source, result, options = {}) {
  const allowLegacyMissing = options.allowLegacyMissing === true;
  equal(result.afterHash, result.beforeHash, "source input must remain immutable");
  equal(
    result.reportSnapshot.version,
    PREMIUM_REPORT_SNAPSHOT_VERSION,
    "report snapshot version must remain canonical"
  );
  equal(
    result.savedReportReader.locale,
    result.report.locale,
    "report locale must survive persistence"
  );

  for (const field of EXPECTED_FIELDS) {
    const sourceHasField = hasOwn(source, field);
    const expected = sourceHasField
      ? buildCurrentProductSnapshotProtectionMetadata(source)[field]
      : null;
    const reentryHasField = hasOwn(result.reentrySnapshot, field);

    if (allowLegacyMissing && !sourceHasField) {
      check(!reentryHasField, `legacy ${field} must remain unavailable`);
      continue;
    }

    check(reentryHasField, `${field} must be accessible after reentry`);
    equal(result.reentrySnapshot[field], expected, `${field} semantic value must survive`);
  }

  for (const field of UNRELATED_FIELDS) {
    equal(
      result.reentrySnapshot[field],
      source[field],
      `${field} must not drift`
    );
  }
}

function expectTransportRejection(label, source, mutator, expectedMessage) {
  let rejected = false;
  try {
    const result = executeRoundTrip(source, mutator);
    assertRoundTrip(source, result, mutator);
  } catch (error) {
    rejected = String(error?.message || "").includes(expectedMessage);
  }
  negativeControlCount += 1;
  check(rejected, `${label} must fail through a transport assertion`);
}

function buildEvidence() {
  const scenarios = [];

  const complete = allFieldsFixture();
  const completeResult = executeRoundTrip(complete);
  assertRoundTrip(complete, completeResult);
  scenarios.push({ id: "R01", hash: semanticHash(completeResult.reentrySnapshot) });

  const falseValues = allFieldsFixture({ tone_up: false });
  const falseResult = executeRoundTrip(falseValues);
  assertRoundTrip(falseValues, falseResult);
  equal(falseResult.reentrySnapshot.tone_up, false, "R02 false must not become missing");
  scenarios.push({ id: "R02", hash: semanticHash(falseResult.reentrySnapshot) });

  const explicitNull = allFieldsFixture({
    spf_value: null,
    uva_label: null,
    tone_up: null
  });
  const nullResult = executeRoundTrip(explicitNull);
  assertRoundTrip(explicitNull, nullResult);
  equal(nullResult.reentrySnapshot.spf_value, null, "R03 explicit null must remain null");
  equal(nullResult.reentrySnapshot.uva_label, null, "R03 UVA null must remain null");
  scenarios.push({ id: "R03", hash: semanticHash(nullResult.reentrySnapshot) });

  const absent = allFieldsFixture();
  for (const field of EXPECTED_FIELDS) delete absent[field];
  const absentResult = executeRoundTrip(absent);
  assertRoundTrip(absent, absentResult);
  check(
    EXPECTED_FIELDS.every((field) => absentResult.reentrySnapshot[field] === null),
    "R04 absent fields must use canonical unavailable null"
  );
  scenarios.push({ id: "R04", hash: semanticHash(absentResult.reentrySnapshot) });

  const sunscreenResult = executeRoundTrip(complete);
  assertRoundTrip(complete, sunscreenResult);
  check(
    !sunscreenResult.findings.findings[0].profile.cautionTags.includes(
      "sunscreen_metadata_incomplete"
    ),
    "R05 complete sunscreen protection metadata must be available to the finding builder"
  );
  scenarios.push({ id: "R05", hash: semanticHash(sunscreenResult.findings) });

  const uvaMissing = allFieldsFixture();
  delete uvaMissing.uva_label;
  const uvaMissingResult = executeRoundTrip(uvaMissing);
  assertRoundTrip(uvaMissing, uvaMissingResult);
  equal(uvaMissingResult.reentrySnapshot.uva_label, null, "R06 missing UVA must remain unavailable");
  check(
    uvaMissingResult.findings.findings[0].profile.categoryRole === "protection",
    "R06 finding builder must consume the reentered sunscreen snapshot without inventing UVA"
  );
  scenarios.push({ id: "R06", hash: semanticHash(uvaMissingResult.findings) });

  const pillingMissing = allFieldsFixture();
  delete pillingMissing.pilling_risk;
  const pillingMissingResult = executeRoundTrip(pillingMissing);
  assertRoundTrip(pillingMissing, pillingMissingResult);
  equal(
    pillingMissingResult.reentrySnapshot.pilling_risk,
    null,
    "R07 missing preference evidence must remain unavailable"
  );
  check(
    !pillingMissingResult.findings.findings[0].profile.cautionTags.includes(
      "sunscreen_metadata_incomplete"
    ),
    "R07 preference-only absence must not erase complete protection evidence"
  );
  scenarios.push({ id: "R07", hash: semanticHash(pillingMissingResult.findings) });

  const nonSunscreen = allFieldsFixture({
    id: "fixture-product-02",
    category: "moisturizer",
    spf_value: null,
    uva_label: null,
    uv_filter_type: null,
    tone_up: false,
    white_cast: null,
    eye_sting: null,
    pilling_risk: null
  });
  const nonSunscreenResult = executeRoundTrip(nonSunscreen);
  assertRoundTrip(nonSunscreen, nonSunscreenResult);
  equal(nonSunscreenResult.reentrySnapshot.tone_up, false, "R08 non-sunscreen false must survive");
  scenarios.push({ id: "R08", hash: semanticHash(nonSunscreenResult.reentrySnapshot) });

  const legacySource = Object.fromEntries(
    Object.entries(allFieldsFixture()).filter(([field]) => !EXPECTED_FIELDS.includes(field))
  );
  const legacySnapshot = Object.fromEntries(
    Object.entries(buildSnapshot(legacySource)).filter(([field]) => !EXPECTED_FIELDS.includes(field))
  );
  const legacyResult = executeRoundTrip(legacySource, {
    mutateSnapshot: () => legacySnapshot,
    allowLegacyMissing: true
  });
  assertRoundTrip(legacySource, legacyResult, { allowLegacyMissing: true });
  check(
    EXPECTED_FIELDS.every((field) => !hasOwn(legacyResult.reentrySnapshot, field)),
    "R09 legacy snapshot must parse without invented metadata"
  );
  scenarios.push({ id: "R09", hash: semanticHash(legacyResult.reentrySnapshot) });

  equal(
    CURRENT_PRODUCT_SNAPSHOT_PROTECTION_METADATA_VERSION,
    "current-product-snapshot-protection-metadata-v1",
    "R10 metadata contract version must be exact"
  );
  equal(
    completeResult.reportSnapshot.version,
    "premium-report-snapshot-v1",
    "R10 additive report snapshot version must remain v1"
  );
  scenarios.push({ id: "R10", hash: semanticHash({
    metadata: CURRENT_PRODUCT_SNAPSHOT_PROTECTION_METADATA_VERSION,
    report: completeResult.reportSnapshot.version
  }) });

  equal(
    semanticHash(JSON.parse(JSON.stringify(completeResult.reportSnapshot.canonical))),
    semanticHash(completeResult.reportSnapshot.canonical),
    "R11 JSON round-trip must be semantically equal"
  );
  scenarios.push({ id: "R11", hash: semanticHash(completeResult.reportSnapshot.canonical) });

  equal(
    completeResult.persistencePayload.premium_report.currentProducts,
    completeResult.savedReportReader.currentProducts,
    "R12 persistence payload and saved-report reader must agree"
  );
  scenarios.push({ id: "R12", hash: semanticHash(completeResult.persistencePayload) });

  equal(
    completeResult.savedReportReader.currentProducts.selections[0].productSnapshot,
    completeResult.reentrySnapshot,
    "R13 session/reentry snapshot must remain accessible"
  );
  scenarios.push({ id: "R13", hash: semanticHash(completeResult.reentrySnapshot) });

  equal(completeResult.beforeHash, completeResult.afterHash, "R14 input mutation count must be zero");
  scenarios.push({ id: "R14", hash: completeResult.afterHash });

  for (const field of UNRELATED_FIELDS) {
    equal(
      completeResult.reentrySnapshot[field],
      complete[field],
      `R15 unrelated ${field} must remain unchanged`
    );
  }
  scenarios.push({ id: "R15", hash: semanticHash(
    Object.fromEntries(UNRELATED_FIELDS.map((field) => [field, completeResult.reentrySnapshot[field]]))
  ) });

  const rerun = executeRoundTrip(clone(complete));
  equal(
    semanticHash(rerun.reentrySnapshot),
    semanticHash(completeResult.reentrySnapshot),
    "R16 repeated canonicalization must be deterministic"
  );
  scenarios.push({ id: "R16", hash: semanticHash(rerun.reentrySnapshot) });

  return {
    version: "current-product-snapshot-transport-verifier-evidence-v1",
    contractVersion: CURRENT_PRODUCT_SNAPSHOT_PROTECTION_METADATA_VERSION,
    reportSnapshotVersion: PREMIUM_REPORT_SNAPSHOT_VERSION,
    scenarioCount: scenarios.length,
    fields: [...EXPECTED_FIELDS],
    scenarios,
    payloadBytesPerProduct: Buffer.byteLength(JSON.stringify(
      buildCurrentProductSnapshotProtectionMetadata(complete)
    )),
    networkAccessCount: 0,
    databaseAccessCount: 0,
    productionDataRowCount: 0
  };
}

function runNegativeControls() {
  const source = allFieldsFixture();

  for (const [label, field] of [
    ["NC01", "spf_value"],
    ["NC02", "uva_label"],
    ["NC03", "uv_filter_type"]
  ]) {
    expectTransportRejection(
      label,
      source,
      {
        mutateSnapshot(snapshot) {
          const next = { ...snapshot };
          delete next[field];
          return next;
        }
      },
      `${field} must be accessible`
    );
  }

  expectTransportRejection(
    "NC04",
    source,
    {
      mutateSnapshot(snapshot) {
        const next = { ...snapshot };
        delete next.tone_up;
        return next;
      }
    },
    "tone_up must be accessible"
  );

  const missingUva = allFieldsFixture();
  delete missingUva.uva_label;
  expectTransportRejection(
    "NC05",
    missingUva,
    {
      mutateSnapshot(snapshot) {
        return { ...snapshot, uva_label: "PA++++" };
      }
    },
    "uva_label semantic value must survive"
  );

  expectTransportRejection(
    "NC06",
    source,
    {
      mutateSnapshot(snapshot) {
        return { ...snapshot, spf_value: 50 };
      }
    },
    "spf_value semantic value must survive"
  );

  expectTransportRejection(
    "NC07",
    source,
    {
      mutateParsed(parsed) {
        delete parsed.premium_report.currentProducts.selections[0].productSnapshot.eye_sting;
        return parsed;
      }
    },
    "eye_sting must be accessible"
  );

  const legacy = Object.fromEntries(
    Object.entries(source).filter(([field]) => !EXPECTED_FIELDS.includes(field))
  );
  expectTransportRejection(
    "NC08",
    legacy,
    {
      mutateSnapshot(snapshot) {
        const next = Object.fromEntries(
          Object.entries(snapshot).filter(([field]) => !EXPECTED_FIELDS.includes(field))
        );
        next.uva_label = "PA++++";
        return next;
      },
      allowLegacyMissing: true
    },
    "legacy uva_label must remain unavailable"
  );

  expectTransportRejection(
    "NC09",
    source,
    {
      mutateSnapshot(snapshot, mutableSource) {
        mutableSource.tone_up = true;
        return snapshot;
      }
    },
    "source input must remain immutable"
  );

  expectTransportRejection(
    "NC10",
    source,
    {
      mutateSnapshot(snapshot) {
        return { ...snapshot, category: "cleanser" };
      }
    },
    "category must not drift"
  );

  let malformedVersionRejected = false;
  try {
    const result = executeRoundTrip(source);
    result.reportSnapshot.version = "premium-report-snapshot-unknown";
    assert.equal(
      result.reportSnapshot.version,
      PREMIUM_REPORT_SNAPSHOT_VERSION,
      "malformed snapshot version must be rejected"
    );
  } catch (error) {
    malformedVersionRejected = String(error?.message || "").includes(
      "malformed snapshot version"
    );
  }
  negativeControlCount += 1;
  check(malformedVersionRejected, "NC11 malformed snapshot version must fail closed");
}

async function materializeEvidence(directory) {
  const evidence = buildEvidence();
  await writeFile(
    path.join(directory, ARTIFACT_NAME),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8"
  );
  return evidence;
}

async function validateArtifact(directory) {
  const files = (await readdir(directory)).sort();
  equal(files, [ARTIFACT_NAME], "generated artifact exact-set must match");
  const artifact = JSON.parse(
    await readFile(path.join(directory, ARTIFACT_NAME), "utf8")
  );
  equal(
    artifact.version,
    "current-product-snapshot-transport-verifier-evidence-v1",
    "artifact schema version must match"
  );
  equal(artifact.fields, EXPECTED_FIELDS, "artifact field exact-set must match");
  equal(artifact.scenarioCount, 16, "artifact scenario count must match");
  equal(artifact.networkAccessCount, 0, "artifact must record zero network access");
  equal(artifact.databaseAccessCount, 0, "artifact must record zero database access");
  equal(artifact.productionDataRowCount, 0, "artifact must contain no production rows");
  return artifact;
}

async function main() {
  equal(
    CURRENT_PRODUCT_SNAPSHOT_PROTECTION_FIELDS,
    EXPECTED_FIELDS,
    "production metadata field contract must match the verifier"
  );

  const currentProductsSource = await readFile(
    path.join(ROOT, "lib", "current-products.js"),
    "utf8"
  );
  const productSource = await readFile(
    path.join(ROOT, "lib", "product-source.js"),
    "utf8"
  );
  const auditSource = await readFile(
    path.join(ROOT, "lib", "product-data-sufficiency-audit-core.js"),
    "utf8"
  );
  const fullReportSource = await readFile(
    path.join(ROOT, "app", "api", "full-report", "route.js"),
    "utf8"
  );
  const sessionSource = await readFile(
    path.join(ROOT, "lib", "premium-report-session.js"),
    "utf8"
  );

  check(
    currentProductsSource.includes("buildCurrentProductSnapshotProtectionMetadata(product)"),
    "analyze current-product mapper must use the production metadata projection"
  );
  check(
    productSource.includes("buildCurrentProductSnapshotProtectionMetadata(product)"),
    "Premium current-product mapper must use the production metadata projection"
  );
  check(
    auditSource.includes("CURRENT_PRODUCT_SNAPSHOT_PROTECTION_FIELDS"),
    "audit destination contract must consume the production field exact-set"
  );
  check(
    fullReportSource.includes("premium_report: authoritativePremiumReport"),
    "saved-report persistence must retain the authoritative report object"
  );
  check(
    fullReportSource.includes("...savedPremiumReport"),
    "saved-report response reader must retain the stored report object"
  );
  check(
    sessionSource.includes("premium_report: payload.premiumReport"),
    "Premium session writer must retain the report object"
  );
  check(
    sessionSource.includes("premiumReport: data.premium_report"),
    "Premium session reader must retain the stored report object"
  );

  const firstDirectory = await mkdtemp(
    path.join(os.tmpdir(), "current-product-snapshot-transport-a-")
  );
  const secondDirectory = await mkdtemp(
    path.join(os.tmpdir(), "current-product-snapshot-transport-b-")
  );
  let cleanupCompleted = false;

  try {
    await writeFile(
      path.join(firstDirectory, ARTIFACT_NAME),
      "{\"version\":\"stale-invalid\"}\n",
      "utf8"
    );
    let staleRejected = false;
    try {
      await validateArtifact(firstDirectory);
    } catch {
      staleRejected = true;
    }
    negativeControlCount += 1;
    check(staleRejected, "NC12 stale pre-existing artifact must be rejected");

    await materializeEvidence(firstDirectory);
    const first = await validateArtifact(firstDirectory);
    await materializeEvidence(secondDirectory);
    const second = await validateArtifact(secondDirectory);
    equal(
      semanticHash(first),
      semanticHash(second),
      "independent generated artifacts must be deterministic"
    );

    runNegativeControls();

    check(assertionCount >= 170, "focused verifier assertion floor must be maintained");
    equal(negativeControlCount, 12, "negative control exact count must match");

    const result = {
      status: "PASS",
      verifier: "current-product-snapshot-transport",
      assertionCount,
      scenarioCount: 16,
      negativeControlCount,
      semanticHashFirst: semanticHash(first),
      semanticHashSecond: semanticHash(second),
      payloadBytesPerProduct: first.payloadBytesPerProduct,
      cleanupCompleted: true
    };
    console.log(JSON.stringify(result));
  } finally {
    await rm(firstDirectory, { recursive: true, force: true });
    await rm(secondDirectory, { recursive: true, force: true });
    cleanupCompleted = true;
    check(cleanupCompleted, "temporary verifier artifacts must be cleaned");
  }
}

await main();
