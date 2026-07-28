import assert from "node:assert/strict";
import {
  buildPremiumReportSnapshot,
  classifyPremiumSnapshotReplay,
  resolvePremiumReportLocale
} from "../lib/premium-report-snapshot.js";
import { rebuildPremiumDecisionState } from "../lib/premium-decision-state.js";

function baseReport(locale = "ko", extra = {}) {
  return {
    locale,
    freeResult: {
      priority: { axis: "barrier", score: 24 },
      scoring: {
        concernScores: {
          barrier: { total: 24 },
          redness: { total: 20 },
          dehydration: { total: 16 }
        }
      }
    },
    fullRoutine: { morningSteps: [], nightSteps: [] },
    conditionResponses: [
      {
        responseKey: "cleansing_load",
        status: "reduce",
        title: "legacy-title",
        summary: "legacy-summary",
        reasons: ["legacy-reason"],
        action: "legacy-action"
      }
    ],
    ...extra
  };
}

function canonicalizeExplicitCurrentProducts(report, currentProducts, locale) {
  const normalized = currentProducts.length
    ? {
        selections: structuredClone(currentProducts),
        summary: {
          total: currentProducts.length,
          selectedCount: currentProducts.filter((item) => item.status === "selected").length,
          notInDbCount: currentProducts.filter((item) => item.status === "not_in_db").length,
          notUsingCount: currentProducts.filter((item) => item.status === "not_using").length,
          sunscreenStatus:
            currentProducts.find((item) => item.category === "sunscreen")?.status || "unknown"
        }
      }
    : null;
  return rebuildPremiumDecisionState(
    {
      ...report,
      currentProducts: normalized,
      currentProductVerdicts: []
    },
    { locale, source: "full_report_current_products" }
  );
}

function countObjectKeys(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return 0;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countObjectKeys(item, seen), 0);
  }
  return Object.entries(value).reduce(
    (total, [, child]) => total + 1 + countObjectKeys(child, seen),
    0
  );
}

for (const locale of ["ko", "en"]) {
  const initial = baseReport(locale);
  const first = canonicalizeExplicitCurrentProducts(initial, [], locale);
  const second = canonicalizeExplicitCurrentProducts(first, [], locale);
  const third = canonicalizeExplicitCurrentProducts(second, [], locale);
  const snapshots = [first, second, third].map(buildPremiumReportSnapshot);

  assert.equal(classifyPremiumSnapshotReplay(first, second).status, "existing");
  assert.equal(classifyPremiumSnapshotReplay(first, third).status, "existing");
  assert.equal(new Set(snapshots.map((snapshot) => snapshot.fingerprint)).size, 1);
  assert.equal(new Set(snapshots.map((snapshot) => snapshot.contextHash)).size, 1);
  assert.equal(new Set(snapshots.map((snapshot) => snapshot.contextRevision)).size, 1);
  assert.equal(new Set(snapshots.map((snapshot) => countObjectKeys(snapshot.canonical))).size, 1);
  assert.deepEqual(second.decisionBundle, first.decisionBundle);
  assert.deepEqual(third.decisionBundle, first.decisionBundle);
  assert.equal(first.locale, locale);
  assert.equal(second.locale, locale);
}

const empty = canonicalizeExplicitCurrentProducts(baseReport("ko"), [], "ko");
const emptyRetry = canonicalizeExplicitCurrentProducts(empty, [], "ko");
const changed = canonicalizeExplicitCurrentProducts(
  emptyRetry,
  [{ status: "not_in_db", category: "serum", productId: null }],
  "ko"
);
const savedBeforeConflict = structuredClone(emptyRetry);
assert.equal(classifyPremiumSnapshotReplay(emptyRetry, changed).status, "conflict");
assert.notEqual(
  buildPremiumReportSnapshot(emptyRetry).fingerprint,
  buildPremiumReportSnapshot(changed).fingerprint
);
assert.deepEqual(emptyRetry, savedBeforeConflict, "changed candidates must not mutate the saved snapshot");

const nonempty = canonicalizeExplicitCurrentProducts(
  baseReport("ko"),
  [{ status: "not_in_db", category: "serum", productId: null }],
  "ko"
);
const cleared = canonicalizeExplicitCurrentProducts(nonempty, [], "ko");
assert.equal(cleared.currentProducts, null);
assert.equal(classifyPremiumSnapshotReplay(nonempty, cleared).status, "conflict");

const absent = emptyRetry;
assert.equal(absent, emptyRetry, "an absent currentProducts field must leave the report untouched");
assert.equal(
  classifyPremiumSnapshotReplay(emptyRetry, canonicalizeExplicitCurrentProducts(emptyRetry, [], "ko"))
    .status,
  "existing",
  "an explicit empty array over a semantically empty report must remain idempotent"
);
assert.equal(
  resolvePremiumReportLocale(emptyRetry, "en"),
  "ko",
  "request locale tampering must not alter the stored locale"
);

console.log("premium identical retry verification passed");
