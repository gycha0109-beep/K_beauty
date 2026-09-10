import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  PRODUCT_EVIDENCE_AUTHORITY_READ_CONTRACT_VERSION,
  PRODUCT_EVIDENCE_PRESENTATION_CANONICAL_FACT_KEYS,
  PRODUCT_EVIDENCE_PRESENTATION_FEATURE_KEYS,
  buildProductEvidencePresentationFromAuthorityRead
} from "../lib/product-evidence-presentation-provider.js";
import { validateProductEvidencePresentationProjection } from "../lib/product-evidence-presentation-contract.js";

const evidence = (overrides = {}) => ({
  evidence_id: "00000000-0000-4000-8000-000000000101",
  source_id: "00000000-0000-4000-8000-000000000201",
  binding_id: "00000000-0000-4000-8000-000000000301",
  link_role: "supporting",
  evidence_class: "product_claim",
  evidence_authority: "product_specific_primary",
  support_direction: "supports",
  negative_admissibility: "not_applicable",
  ...overrides
});

const fact = (factKey, overrides = {}) => ({
  fact_instance_id: `fact-${factKey}`,
  subject_id: "subject-1",
  registry_version: "product-fact-registry-cross-category-v1",
  fact_key: factKey,
  proposition_key: `prop-${factKey}`,
  confirmation_id: `confirmation-${factKey}`,
  semantic_status: "supported",
  value_type: "enum",
  value_enum: "example",
  authority_ceiling: "product_specific_primary",
  evidence: [evidence()],
  ...overrides
});

assert.deepEqual(PRODUCT_EVIDENCE_PRESENTATION_CANONICAL_FACT_KEYS, {
  eye_sting: "eye_sting_observed",
  white_cast: "white_cast_observed",
  pilling_risk: null,
  finish: null
});

const payload = {
  read_contract_version: PRODUCT_EVIDENCE_AUTHORITY_READ_CONTRACT_VERSION,
  status: "AUTHORITY_RESOLVED",
  product_id: "product-1",
  subject: { subject_id: "subject-1" },
  current_facts: [
    fact("eye_sting_observed", {
      evidence: [
        evidence(),
        evidence({
          evidence_id: "00000000-0000-4000-8000-000000000102",
          source_id: "00000000-0000-4000-8000-000000000202"
        })
      ]
    }),
    fact("white_cast_observed", {
      semantic_status: "evidence_conflict",
      authority_ceiling: "review_observation",
      evidence: [
        evidence({
          evidence_id: "00000000-0000-4000-8000-000000000103",
          evidence_class: "observation",
          evidence_authority: "review_observation"
        }),
        evidence({
          evidence_id: "00000000-0000-4000-8000-000000000104",
          link_role: "opposing",
          evidence_class: "observation",
          evidence_authority: "review_observation",
          support_direction: "opposes",
          negative_admissibility: "conflict_opposition"
        })
      ]
    }),
    fact("pilling_risk"),
    fact("finish")
  ]
};

const result = buildProductEvidencePresentationFromAuthorityRead(payload);
assert.equal(result.authorityResolved, true);
assert.deepEqual(
  result.projections.map((projection) => projection.featureKey),
  PRODUCT_EVIDENCE_PRESENTATION_FEATURE_KEYS
);
for (const projection of result.projections) {
  assert.deepEqual(validateProductEvidencePresentationProjection(projection), { valid: true, errors: [] });
  assert.equal(projection.evidenceView.independentSupport, "unresolved");
  assert.equal(projection.evidenceView.recency, "unknown");
}

const byFeature = Object.fromEntries(result.projections.map((projection) => [projection.featureKey, projection]));
assert.equal(byFeature.eye_sting.knowledgeState, "supported");
assert.equal(byFeature.eye_sting.recommendationUse, "explanation_only");
assert.equal(byFeature.eye_sting.evidenceRefs.length, 2);
assert.equal(byFeature.eye_sting.presentation.tone, "plain");
assert.equal(byFeature.white_cast.knowledgeState, "evidence_conflict");
assert.equal(byFeature.white_cast.recommendationUse, "blocked");
assert.equal(byFeature.white_cast.evidenceView.agreement, "mixed");
assert.equal(byFeature.white_cast.presentation.tone, "mixed");
assert.equal(byFeature.pilling_risk.knowledgeState, null);
assert.equal(byFeature.pilling_risk.recommendationUse, "blocked");
assert.equal(byFeature.finish.knowledgeState, null);
assert.equal(byFeature.finish.recommendationUse, "blocked");

const uiKeyFallback = buildProductEvidencePresentationFromAuthorityRead({
  ...payload,
  current_facts: [fact("eye_sting"), fact("white_cast"), fact("pilling_risk"), fact("finish")]
});
assert(uiKeyFallback.projections.every((projection) => projection.knowledgeState === null));
assert(uiKeyFallback.projections.every((projection) => projection.recommendationUse === "blocked"));

const noAuthority = buildProductEvidencePresentationFromAuthorityRead({
  read_contract_version: PRODUCT_EVIDENCE_AUTHORITY_READ_CONTRACT_VERSION,
  status: "NO_AUTHORITY",
  current_facts: payload.current_facts
});
assert.equal(noAuthority.authorityResolved, false);
assert(noAuthority.projections.every((projection) => projection.knowledgeState === null));

const wrongContract = buildProductEvidencePresentationFromAuthorityRead({
  ...payload,
  read_contract_version: "unexpected-contract"
});
assert.equal(wrongContract.authorityResolved, false);
assert(wrongContract.projections.every((projection) => projection.knowledgeState === null));

const malformed = buildProductEvidencePresentationFromAuthorityRead({
  ...payload,
  current_facts: [fact("eye_sting_observed", { semantic_status: "safe" })]
});
assert.equal(malformed.projections[0].knowledgeState, null);
assert.equal(malformed.projections[0].recommendationUse, "blocked");

const legacyAuthority = buildProductEvidencePresentationFromAuthorityRead({
  ...payload,
  current_facts: [
    fact("eye_sting_observed", {
      authority_ceiling: "legacy_unreviewed",
      evidence: [evidence({ evidence_authority: "legacy_unreviewed" })]
    })
  ]
});
assert.equal(legacyAuthority.projections[0].knowledgeState, "supported");
assert.equal(legacyAuthority.projections[0].factRef, null);
assert.equal(legacyAuthority.projections[0].evidenceRefs.length, 0);
assert.equal(legacyAuthority.projections[0].recommendationUse, "blocked");

const duplicateCurrentFact = buildProductEvidencePresentationFromAuthorityRead({
  ...payload,
  current_facts: [
    fact("eye_sting_observed"),
    fact("eye_sting_observed", { fact_instance_id: "fact-eye-sting-observed-2" })
  ]
});
assert.equal(duplicateCurrentFact.projections[0].knowledgeState, null);
assert.equal(duplicateCurrentFact.projections[0].recommendationUse, "blocked");

const providerSource = await readFile(
  new URL("../lib/product-evidence-presentation-provider.js", import.meta.url),
  "utf8"
);
const migrationSource = await readFile(
  new URL(
    "../supabase/migrations/20260910124000_product_evidence_presentation_canonical_fact_keys_v1.sql",
    import.meta.url
  ),
  "utf8"
);
const workflowSource = await readFile(
  new URL("../.github/workflows/product-evidence-presentation-provider.yml", import.meta.url),
  "utf8"
);

for (const requiredToken of [
  "product_fact_current",
  "product_fact_instances",
  "product_fact_evidence_links",
  "product_evidence_records",
  "eye_sting_observed",
  "white_cast_observed",
  "TRUST_P31_RUNTIME_RAW_SELECT_FORBIDDEN"
]) {
  assert(migrationSource.includes(requiredToken), `missing canonical boundary token: ${requiredToken}`);
}
assert(migrationSource.includes("i.fact_key in ('eye_sting_observed', 'white_cast_observed')"));
assert(workflowSource.includes("20260910124000_product_evidence_presentation_canonical_fact_keys_v1.sql"));

for (const forbiddenToken of [
  "review_signals",
  "market_signals",
  "ingredient_signals",
  "products.white_cast",
  "products.eye_sting",
  "products.pilling_risk",
  "trustScore",
  "evidenceStrength"
]) {
  assert.equal(migrationSource.includes(forbiddenToken), false, `forbidden migration fallback: ${forbiddenToken}`);
  assert.equal(providerSource.includes(forbiddenToken), false, `forbidden provider fallback: ${forbiddenToken}`);
}

assert(providerSource.includes('independentSupport: "unresolved"'));
assert.equal(providerSource.includes('independentSupport: "multiple"'), false);
assert(providerSource.includes('recency: "unknown"'));
assert.equal(providerSource.includes('recency: "current"'), false);
assert(migrationSource.includes("from public, anon, authenticated, service_role"));
assert(migrationSource.includes("to recommendation_admission_runtime"));

for (const scorerPath of ["../lib/recommendation-scoring.ts", "../lib/skin-match-decision-engine.js"]) {
  const scorerSource = await readFile(new URL(scorerPath, import.meta.url), "utf8");
  assert.equal(
    scorerSource.includes("product-evidence-presentation-provider"),
    false,
    `${scorerPath}: product evidence provider must not enter recommendation semantics`
  );
}

console.log(
  "verify-product-evidence-presentation-provider: PASS " +
    "canonical_key_mapping=1 unsupported_registry_keys_blocked=1 legacy_fallback=0 " +
    "independent_count_inference=0 ranking_integration=0"
);
