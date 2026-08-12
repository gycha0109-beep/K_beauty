import { sha256Json } from "./product-fact-current-resolver-v1.mjs";
import { VERSION as GROUP_RESOLVER_VERSION } from "./product-fact-current-group-resolver-v1.mjs";

export const VERSION = "product-fact-cross-category-fixture-adapter-v1";
export const FIXTURE_SOURCE = "offline_v21_2_materialization_fixture";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function typedValue(proposal) {
  if (proposal.semantic_status !== "supported") return null;
  return proposal.typed_value;
}

function adaptProposal(proposal, subject) {
  return {
    fact_key: proposal.fact_key,
    presence: "current",
    semantic_status: proposal.semantic_status,
    value_type: proposal.semantic_status === "supported" ? proposal.typed_columns?.value_type ?? null : null,
    typed_value: typedValue(proposal),
    authority_ceiling: proposal.authority_ceiling,
    fused_confidence: proposal.fused_confidence,
    registry_version: proposal.registry_version,
    fusion_policy_version: proposal.fusion_policy_version,
    fusion_input_digest: proposal.fusion_input_digest,
    proposition_key: proposal.proposition_key,
    scope: {
      market: proposal.scope?.market ?? null,
      region: proposal.scope?.region ?? null,
      locale: proposal.scope?.locale ?? null,
      valid_from: proposal.scope?.valid_from ?? null,
      valid_to: proposal.scope?.valid_to ?? null,
      subject_variant_key: subject.proposed_subject_identity?.variant_key ?? null,
      subject_formulation_revision_key: subject.proposed_subject_identity?.formulation_revision_key ?? null,
      subject_market_applicability: subject.proposed_subject_identity?.market_applicability ?? null,
      subject_region_applicability: subject.proposed_subject_identity?.region_applicability ?? null,
    },
    qualifier: proposal.qualifier_context ?? {},
    parent_proposition_key: proposal.parent_proposition_key ?? null,
    parent_fact_instance_id: proposal.frozen_parent_fact_instance_id ?? null,
    provenance: {
      source: FIXTURE_SOURCE,
      fixture_only: true,
      hosted_current: false,
      pilot_id: proposal.pilot_id,
      frozen_fact_instance_id: proposal.frozen_fact_instance_id,
      supporting_evidence_refs: [...(proposal.supporting_evidence_refs ?? [])],
      opposing_evidence_refs: [...(proposal.opposing_evidence_refs ?? [])],
      context_evidence_refs: [...(proposal.context_evidence_refs ?? [])],
    },
  };
}

export function adaptCrossCategoryDryRunProduct({ materialization, registry, mapping, pilotId, factKeys }) {
  invariant(materialization?.dry_run_version === "cross-category-pilot-materialization-dry-run-v1", "unexpected materialization fixture");
  invariant(registry?.registry_version === "product-fact-registry-cross-category-v1", "unexpected registry fixture");
  const subject = materialization.subjects.find((item) => item.pilot_id === pilotId);
  invariant(subject, `missing subject ${pilotId}`);
  const mapped = mapping.products.find((item) => item.pilot_id === pilotId);
  invariant(mapped, `missing mapping product ${pilotId}`);
  const definitions = new Map(registry.facts.map((definition) => [definition.fact_key, definition]));

  const identityBlocked = subject.identity_status !== "resolved" || subject.proposed_subject_identity?.current_state !== "current";
  const proposals = identityBlocked ? [] : materialization.fact_proposals.filter((proposal) => proposal.pilot_id === pilotId);
  const groups = factKeys.map((factKey) => {
    const definition = definitions.get(factKey);
    invariant(definition, `missing registry definition ${factKey}`);
    const facts = proposals.filter((proposal) => proposal.fact_key === factKey).map((proposal) => adaptProposal(proposal, subject)).sort((a, b) => a.proposition_key.localeCompare(b.proposition_key, "en"));
    if (definition.cardinality === "one") invariant(facts.length <= 1, `fixture violates cardinality one for ${factKey}`);
    return { fact_key: factKey, cardinality: definition.cardinality, presence: facts.length ? "current" : "missing_current", facts };
  });

  const reviewContext = Object.fromEntries((mapped.review_coverage ?? []).map((item) => [item.fact_key ?? item.candidate_concept, { ...item }]));
  return {
    resolver_version: GROUP_RESOLVER_VERSION,
    fixture_adapter_version: VERSION,
    resolver_source: FIXTURE_SOURCE,
    fixture_only: true,
    hosted_current: false,
    catalog_adopted: false,
    pilot_id: pilotId,
    product_id: subject.catalog_product_id,
    domain: mapped.domain,
    identity_status: subject.identity_status,
    identity_blocked: identityBlocked,
    identity_reasoning: subject.identity_reasoning,
    groups,
    review_context: reviewContext,
    resolver_input_digest: sha256Json({ pilot_id: pilotId, product_id: subject.catalog_product_id, identity_status: subject.identity_status, groups, review_context: reviewContext }),
  };
}
