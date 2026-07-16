import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRODUCT_DATA_SUFFICIENCY_AUDIT_VERSION,
  buildProductDataSufficiencyAudit
} from "../lib/product-data-sufficiency-audit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(
  __dirname,
  "fixtures",
  "product-data-sufficiency",
  "mixed-audit-dataset.json"
);
const products = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const pristine = structuredClone(products);

const audit = buildProductDataSufficiencyAudit(products, { sourceType: "fixture" });
const reversedAudit = buildProductDataSufficiencyAudit([...products].reverse(), {
  sourceType: "fixture"
});

assert.equal(audit.version, PRODUCT_DATA_SUFFICIENCY_AUDIT_VERSION);
assert.equal(audit.dataset.rowCount, products.length);
assert.equal(audit.dataset.sourceType, "fixture");
assert.equal(audit.dataset.datasetHash.length, 64);
assert.deepEqual(audit, reversedAudit);
assert.deepEqual(products, pristine);
assert.equal(audit.status, "critical_gaps");

const treatment = audit.rows.find((row) => row.productId === "treatment-complete");
assert.equal(treatment.categorySemantics.recommendationEligible, true);
assert.equal(treatment.capabilities.functionalProfileEvaluable, true);
assert.equal(treatment.capabilities.directGoalSupportEvaluable, true);
assert.equal(treatment.capabilities.safetyDecisionReady, true);
assert.equal(treatment.functionalAxes.some((axis) => axis.axis === "exfoliation"), true);

const sunscreen = audit.rows.find((row) => row.productId === "sunscreen-complete");
assert.equal(sunscreen.capabilities.sunscreenProtectionReady, true);
assert.equal(sunscreen.capabilities.sunscreenPreferenceReady, true);
assert.equal(
  sunscreen.gaps.some(
    (gap) => gap.code === "SNAPSHOT_FIELD_DROPPED" && gap.fieldPaths.includes("uv_filter_type")
  ),
  true
);

const legacy = audit.rows.find((row) => row.productId === "legacy-serum");
assert.equal(legacy.categorySemantics.recommendationEligible, false);
assert.equal(legacy.categorySemantics.currentProductCategoryUsable, true);
assert.equal(legacy.gaps.some((gap) => gap.code === "CATEGORY_LEGACY"), true);
assert.equal(legacy.gaps.some((gap) => gap.code === "SAFETY_UNKNOWN_COERCED"), true);
assert.equal(legacy.gaps.some((gap) => gap.code === "FUNCTIONAL_LABEL_UNKNOWN"), true);

const duplicateRows = audit.rows.filter((row) => row.productId === "duplicate-product");
assert.equal(duplicateRows.length, 2);
assert.equal(
  duplicateRows.every((row) => row.gaps.some((gap) => gap.code === "PRODUCT_ID_DUPLICATE")),
  true
);
assert.equal(
  duplicateRows.some((row) => row.gaps.some((gap) => gap.code === "SOURCE_JSON_MALFORMED")),
  true
);

assert.deepEqual(audit.unknownFunctionalLabels, [
  {
    label: "new unknown label",
    productCount: 1,
    sampleProductIds: ["legacy-serum"]
  }
]);
assert.equal(
  audit.transportGaps.some(
    (gap) => gap.fieldPath === "uv_filter_type" && gap.destination === "current_product_snapshot"
  ),
  true
);
assert.equal(audit.summary.totalProducts, products.length);
assert.equal(
  Object.values(audit.byCategory).reduce((sum, item) => sum + item.total, 0),
  products.length
);
assert.equal(
  audit.rows.flatMap((row) => row.gaps).length,
  audit.summary.criticalGapCount + audit.summary.importantGapCount + audit.summary.qualityGapCount
);

const invalid = buildProductDataSufficiencyAudit(null);
assert.equal(invalid.status, "input_invalid");
assert.equal(invalid.rows.length, 0);

console.log("product data sufficiency audit verified");
