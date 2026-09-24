#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { digestOfficialContent } from "../lib/trust/official-source-fetch.mjs";

const cases = JSON.parse(fs.readFileSync("tests/fixtures/trust-phase8g-semantic-adapter/cases.json", "utf8"));
const torridenContext = {
  canonicalLocator: "https://www.torriden.com/goods/goods_view.php?goodsNo=136",
  sourceMetadata: { observed_claim: "다이브인 무기자차 마일드 선크림 60ml" },
};

const noiseA = digestOfficialContent(Buffer.from(cases.noise_a), "official-product-semantic", "v1", torridenContext);
const noiseB = digestOfficialContent(Buffer.from(cases.noise_b), "official-product-semantic", "v1", torridenContext);
assert.equal(noiseA.digestBasis, "canonical-official-product-semantics-v1");
assert.equal(noiseA.digest, noiseB.digest, "storefront telemetry and runtime script noise must not alter semantic digest");

const structuredA = digestOfficialContent(Buffer.from(cases.structured_a), "official-product-semantic", "v1", {});
const structuredOfferNoise = digestOfficialContent(Buffer.from(cases.structured_offer_noise), "official-product-semantic", "v1", {});
const structuredChanged = digestOfficialContent(Buffer.from(cases.structured_semantic_change), "official-product-semantic", "v1", {});
assert.equal(structuredA.digest, structuredOfferNoise.digest, "offers and aggregate rating must not own Product Fact semantic digest");
assert.notEqual(structuredA.digest, structuredChanged.digest, "structured Product semantic change must alter digest");

assert.throws(
  () => digestOfficialContent(Buffer.from(cases.missing_anchor), "official-product-semantic", "v1", torridenContext),
  /SOURCE_SEMANTIC_ADAPTER_REQUIRED_ANCHOR_MISSING/
);
assert.throws(
  () => digestOfficialContent(Buffer.from(cases.unsupported), "official-product-semantic", "v1", {}),
  /SOURCE_SEMANTIC_ADAPTER_UNSUPPORTED/
);

console.log("TRUST_PHASE8G_OFFICIAL_PRODUCT_SEMANTIC_ADAPTER_VERIFIED");
