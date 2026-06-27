import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildFixtureItem } from "./review-signals/build-review-signal-fixture.mjs";
import { buildPlanItem } from "./review-signals/prepare-hwahae-review-raw-batch.mjs";
import {
  assertFixtureHasPayloads,
  loadCsvContext,
} from "./review-signals/review-in-supabase.mjs";

function rawReviewItem(overrides = {}) {
  return {
    productId: overrides.productId || "synthetic-product",
    category: "treatment",
    product_form: "essence",
    review_raw: {
      positive: [["hydrating", 10]],
      negative: [["watery texture", 2]],
    },
    ...overrides,
  };
}

async function fixtureFor(overrides) {
  return buildFixtureItem(rawReviewItem(overrides), { supabase: null, cache: new Map() });
}

const treatmentEssence = await fixtureFor({
  category: "treatment",
  product_form: "essence",
});
assert.equal(treatmentEssence.categoryResolution.status, "valid");
assert.equal(treatmentEssence.categoryResolution.categoryFamily, "serum_ampoule");
assert.equal(treatmentEssence.fixture.review_signal_status, "ready");
assert.notEqual(treatmentEssence.fixture.review_signals, null);

const tonerEssence = await fixtureFor({
  category: "toner_essence",
  product_form: null,
});
assert.equal(tonerEssence.categoryResolution.status, "valid");
assert.equal(tonerEssence.categoryResolution.categoryFamily, "toner");
assert.equal(tonerEssence.fixture.review_signal_status, "ready");
assert.notEqual(tonerEssence.fixture.review_signals, null);

for (const [input, reason] of [
  [{ category: "essence", product_form: null }, "legacy_category"],
  [{ category: "essence", product_form: "essence" }, "legacy_category"],
  [{ category: "serum", product_form: null }, "legacy_category"],
  [{ category: "treatment", product_form: null }, "missing_product_form"],
  [{ category: "toner_essence", product_form: "essence" }, "non_treatment_product_form"],
]) {
  const result = await fixtureFor(input);
  assert.equal(result.categoryResolution.status, "unresolved");
  assert.equal(result.fixture.review_signal_status, "skipped");
  assert.equal(result.fixture.review_signal_skip_reason, reason);
  assert.equal(result.fixture.review_signals, null);
}

const nameOnlyPlan = buildPlanItem(
  {
    id: "name-only",
    name: "Bright Essence Serum",
    product_name: "Bright Essence Serum",
    hwahae_url: "https://www.hwahae.co.kr/goods/1",
  },
  {
    category: "",
    productForm: "",
    categoryFolder: "unknown",
    outDir: path.join(os.tmpdir(), "review-signal-strict-test"),
  },
  null,
);
assert.equal(nameOnlyPlan.category_status, "unresolved");
assert.equal(nameOnlyPlan.product_form, null);
assert.equal(nameOnlyPlan.ready, false);

const liveCanonicalPlan = buildPlanItem(
  {
    id: "live-canonical",
    name: "Live Canonical",
    hwahae_url: "https://www.hwahae.co.kr/goods/2",
  },
  {
    category: "",
    productForm: "",
    categoryFolder: "unknown",
    outDir: path.join(os.tmpdir(), "review-signal-strict-test"),
  },
  {
    name: "Live Canonical",
    category: "treatment",
    product_form: "essence",
    hwahae_url: "https://www.hwahae.co.kr/goods/2",
  },
);
assert.equal(liveCanonicalPlan.category_status, "ready");
assert.equal(liveCanonicalPlan.canonical_category, "treatment");
assert.equal(liveCanonicalPlan.product_form, "essence");

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "review-signal-strict-"));
const essenceCsv = path.join(tempDir, "essence.csv");
await fs.writeFile(
  essenceCsv,
  "id,name,hwahae_url\nlegacy-essence,Legacy Essence,https://www.hwahae.co.kr/goods/3\n",
  "utf8",
);
await assert.rejects(
  () => loadCsvContext(essenceCsv, "", ""),
  /Cannot infer category|Unresolved category\/product_form/,
);

const treatmentCsv = path.join(tempDir, "treatment.csv");
await fs.writeFile(
  treatmentCsv,
  "id,name,category,product_form,hwahae_url\ncanonical-treatment,Treatment Essence,treatment,essence,https://www.hwahae.co.kr/goods/4\n",
  "utf8",
);
const treatmentContext = await loadCsvContext(treatmentCsv, "", "");
assert.equal(treatmentContext.category, "treatment");
assert.equal(treatmentContext.productForm, "essence");
assert.equal(treatmentContext.categoryFolder, "treatment");

const skippedFixture = path.join(tempDir, "skipped-fixture.json");
await fs.writeFile(
  skippedFixture,
  JSON.stringify(
    {
      productId: "legacy-essence",
      review_signal_status: "skipped",
      review_signal_skip_reason: "legacy_category",
      market_signals: { source: "synthetic" },
    },
    null,
    2,
  ),
  "utf8",
);
await assert.rejects(
  () => assertFixtureHasPayloads(skippedFixture),
  /unresolved review-signal item/,
);

console.log("review-signal generation strict semantics verification passed");
