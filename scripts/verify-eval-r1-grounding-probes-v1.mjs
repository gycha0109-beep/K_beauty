import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

register("./node-next-alias-loader.mjs", import.meta.url);
globalThis.fetch = async () => { throw new Error("EVAL_R1_NETWORK_CALL_FORBIDDEN"); };

const recommendationReferenceRoot = path.resolve(process.env.EVAL_R1_RECOMMENDATION_REFERENCE_ROOT || "_reference/recommendation");
const p3ReferenceRoot = path.resolve(process.env.EVAL_R1_P3_REFERENCE_ROOT || "_reference/persona-p3");
const [{ buildRecommendationProductFromSource }, { buildSkinMatchDecisionBundle }, { buildFallbackPhotoAnalysis }] = await Promise.all([
  import("../lib/product-source.js"),
  import("../lib/skin-match-decision-engine.js"),
  import("../lib/photo-evidence.js")
]);
const p3 = await import(pathToFileURL(path.join(p3ReferenceRoot, "scripts/persona-evaluation/eval-p3-contracts.mjs")).href);
const productsFixture = JSON.parse(await readFile(path.join(recommendationReferenceRoot, "fixtures/recommendation-metadata/products-v1.json"), "utf8"));
const products = productsFixture.products.map((raw) => buildRecommendationProductFromSource({ ...(raw.metadata || {}), ...raw, id: raw.id, name: raw.name, brand: raw.brand, category: raw.category }));
const personas = new Map(p3.materializeP3Personas().personas.map((item) => [item.persona_id, item]));

async function run(domain, locale = "ko") {
  return buildSkinMatchDecisionBundle(p3.toRecommendationAnswers(domain), {
    products,
    photoAnalysis: buildFallbackPhotoAnalysis(locale),
    currentProducts: [],
    currentProductSnapshots: [],
    locale
  });
}
const surveyText = (bundle) => (bundle.surveyEvidence || []).map((item) => item.detail || "").join(" ");
const reasonText = (bundle) => String(bundle.topPick?.reason || "");
const clone = (value) => JSON.parse(JSON.stringify(value));

// E1: comfortable must not become post-cleansing tightness.
const c02 = personas.get("P3-C02");
assert(c02);
const comfortable = await run(c02.domain, "ko");
assert(!reasonText(comfortable).includes("세안 뒤 당김"), "E1 comfortable -> tightness forbidden");

// E2: medium sensitivity must not become high sensitivity.
const c06 = personas.get("P3-C06");
assert(c06);
const medium = await run(c06.domain, "ko");
assert(!surveyText(medium).includes("민감도가 높아"), "E2 medium -> high sensitivity forbidden");

// E3: missing input must not create an affirmative user state.
const missingDomain = clone(c06.domain);
delete missingDomain.sensitivity;
delete missingDomain.postWashFeeling;
const missing = await run(missingDomain, "ko");
assert(!surveyText(missing).includes("민감도가 높아"), "E3 missing sensitivity -> high sensitivity invention forbidden");
assert(!reasonText(missing).includes("세안 뒤 당김"), "E3 missing postWashFeeling -> tightness invention forbidden");

// E4: explicit high sensitivity may retain high wording.
const highDomain = clone(c06.domain);
highDomain.sensitivity = "high";
const high = await run(highDomain, "ko");
assert(surveyText(high).includes("민감도가 높아"), "E4 explicit high sensitivity should permit high-sensitivity grounding");

// E5: explicit low state must not become high wording.
const lowDomain = clone(c06.domain);
lowDomain.sensitivity = "low";
const low = await run(lowDomain, "ko");
assert(!surveyText(low).includes("민감도가 높아"), "E5 low -> high sensitivity forbidden");

// E6: derived barrier weighting must not masquerade as an explicit high-sensitivity input.
assert(low.priority?.axis === "barrier", "E6 probe keeps a derived barrier-priority context");
assert(!surveyText(low).includes("민감도가 높아"), "E6 derived barrier state cannot claim high sensitivity without explicit high input");

// E10: locale/template variants preserve the same grounding relation.
const mediumEn = await run(c06.domain, "en");
const lowEn = await run(lowDomain, "en");
const highEn = await run(highDomain, "en");
assert(!surveyText(mediumEn).toLowerCase().includes("high sensitivity"), "E10 medium English -> high sensitivity forbidden");
assert(!surveyText(lowEn).toLowerCase().includes("high sensitivity"), "E10 low English -> high sensitivity forbidden");
assert(surveyText(highEn).toLowerCase().includes("higher sensitivity"), "E10 explicit high English may retain high-sensitivity wording");

console.log("EVAL-R1 focused grounding probes: PASS E1-E6,E10");
