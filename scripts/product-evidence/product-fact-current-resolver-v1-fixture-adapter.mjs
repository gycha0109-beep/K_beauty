import { PF_AUTHORITIES, PF_CONFIDENCE, SEMANTIC_STATUSES, VERSION as RESOLVER_VERSION, missingCurrentFact, sha256Json } from "./product-fact-current-resolver-v1.mjs";

export const VERSION = "product-fact-current-resolver-v1-fixture-adapter";
export const FIXTURE_SOURCE = "offline_v21_4_fusion_fixture";
export const FIXTURE_CONTRACT = "current-fact-like-offline-v1";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function adaptFact(product, fact) {
  invariant(fact && typeof fact === "object", "fusion Fact fixture must be an object");
  invariant(typeof fact.fact_key === "string" && fact.fact_key.length > 0, "fusion Fact fixture fact_key required");
  invariant(SEMANTIC_STATUSES.includes(fact.semantic_status), `invalid fixture semantic_status ${fact.semantic_status}`);
  invariant(PF_AUTHORITIES.includes(fact.authority_ceiling), `invalid fixture authority ${fact.authority_ceiling}`);
  invariant(PF_CONFIDENCE.includes(fact.fused_confidence), `invalid fixture confidence ${fact.fused_confidence}`);
  invariant(typeof fact.fusion_input_digest === "string" && /^[0-9a-f]{64}$/.test(fact.fusion_input_digest), "fixture fusion_input_digest required");
  if (fact.semantic_status === "supported") invariant(typeof fact.value === "boolean", "current cleanser fixture supports Boolean Fact values only");
  else invariant(fact.value === null, "non-supported fixture Fact value must remain null");

  return {
    fact_key: fact.fact_key,
    presence: "current",
    semantic_status: fact.semantic_status,
    value_type: fact.semantic_status === "supported" ? "boolean" : null,
    typed_value: fact.semantic_status === "supported" ? fact.value : null,
    authority_ceiling: fact.authority_ceiling,
    fused_confidence: fact.fused_confidence,
    registry_version: null,
    fusion_policy_version: fact.fusion_policy_version ?? null,
    fusion_input_digest: fact.fusion_input_digest,
    provenance: {
      source: FIXTURE_SOURCE,
      product_id: product.product_id,
      subject_id: null,
      proposition_key: null,
      fact_instance_id: null,
      confirmation_id: null,
      supporting_evidence: [...(fact.supporting_evidence ?? [])],
      opposing_evidence: [...(fact.opposing_evidence ?? [])],
      context_evidence: [...(fact.context_evidence ?? [])],
      fixture_only: true,
    },
  };
}

function missingFixtureFact(productId, factKey) {
  const missing = missingCurrentFact(productId, factKey);
  return {
    ...missing,
    provenance: {
      ...missing.provenance,
      source: FIXTURE_SOURCE,
      fixture_only: true,
    },
  };
}

export function adaptFusionProductToCurrentFactFixture(product, factKeys) {
  invariant(product && typeof product === "object", "fusion product required");
  invariant(typeof product.product_id === "string" && product.product_id.length > 0, "fusion product_id required");
  invariant(product.identity_state?.status === "resolved", "fixture adapter only accepts resolved fusion products");
  invariant(Array.isArray(product.facts), "fusion product facts required");
  invariant(Array.isArray(factKeys) && new Set(factKeys).size === factKeys.length, "factKeys must be unique");

  const byKey = new Map();
  for (const fact of product.facts.map((item) => adaptFact(product, item))) {
    invariant(!byKey.has(fact.fact_key), `duplicate fixture Fact ${fact.fact_key}`);
    byKey.set(fact.fact_key, fact);
  }
  const facts = factKeys.map((factKey) => byKey.get(factKey) ?? missingFixtureFact(product.product_id, factKey));
  return {
    resolver_version: RESOLVER_VERSION,
    fixture_adapter_version: VERSION,
    fixture_contract: FIXTURE_CONTRACT,
    resolver_source: FIXTURE_SOURCE,
    hosted_current: false,
    catalog_adopted: false,
    product_id: product.product_id,
    brand: product.brand,
    name: product.name,
    facts,
    resolver_input_digest: sha256Json({ product_id: product.product_id, facts }),
  };
}
