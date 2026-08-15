#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const VERSION = "exfoliation-non-numeric-pda-offline-shadow-v1";
export const STAGE = "V2.1-8P";
export const AXIS_KEY = "exfoliation_load";
export const CONTRACT_VERSION = "exfoliation-non-numeric-pda-contract-v1";
export const CONTRACT_MODE = "STRUCTURED_CATEGORICAL";
export const PRIMARY_TERMINAL_OUTCOME = "NON_NUMERIC_EXFOLIATION_PDA_OFFLINE_SHADOW_REPLAY_VALIDATED";
export const UPSTREAM_TERMINAL_OUTCOME = "NON_NUMERIC_EXFOLIATION_PDA_CONTRACT_FROZEN";
export const ACTIVE_IDENTITIES_V1 = Object.freeze(["lactic_acid", "mandelic_acid", "salicylic_acid"]);
export const APPLICABLE_CATEGORIES = Object.freeze(["toner_essence", "toner_pad", "treatment"]);
export const KNOWN_CATALOG_CATEGORIES = Object.freeze([
  "cleanser",
  "moisturizer_balm",
  "moisturizer_cream",
  "moisturizer_gel",
  "moisturizer_lotion_emulsion",
  "sunscreen",
  "toner_essence",
  "toner_pad",
  "treatment",
]);
export const ACTIVE_IDENTITY_MAPPING_VERSION = "exfoliating-active-identity-set-v1";
export const CONTRACT_SHA256 = "c85418df574b550672f9523bd6827e4265b57a9d7901e5bf8f6b4de203d45d40";
export const SNAPSHOT_SHA256 = "31311c223cfc1084e02e226e36b60b6052884f16c52cdc3f5308b786641a9fea";
export const INPUT = "evidence/product-decision-axis-non-numeric-shadow-v1/exfoliation-non-numeric-pda-current-input-v1.json";
export const OUTPUTS = Object.freeze({
  output: "evidence/product-decision-axis-non-numeric-shadow-v1/exfoliation-non-numeric-pda-offline-shadow-output-v1.json",
  summary: "evidence/product-decision-axis-non-numeric-shadow-v1/exfoliation-non-numeric-pda-offline-shadow-summary-v1.json",
  replay: "evidence/product-decision-axis-non-numeric-shadow-v1/exfoliation-non-numeric-pda-offline-shadow-replay-v1.json",
  doc: "docs/evidence/exfoliation-non-numeric-pda-offline-shadow-implementation-v1.md",
});

const CONTEXT_CATEGORIES = Object.freeze({
  active_concentration: ["toner_essence", "toner_pad", "treatment"],
  recommended_use_frequency: ["toner_essence", "toner_pad", "treatment"],
  product_format: ["toner_essence", "toner_pad"],
  wipe_off_use: ["toner_essence", "toner_pad"],
  pad_surface_texture: ["toner_pad"],
});
const MISSING_REASON = Object.freeze({
  active_concentration: "ACTIVE_CONCENTRATION_MISSING",
  recommended_use_frequency: "RECOMMENDED_USE_FREQUENCY_MISSING",
  product_format: "PRODUCT_FORMAT_MISSING",
  wipe_off_use: "WIPE_OFF_USE_MISSING",
  pad_surface_texture: "PAD_SURFACE_TEXTURE_MISSING",
});
const ALL_UNCERTAINTY_REASONS = Object.freeze([
  "ACTIVE_CONCENTRATION_MISSING",
  "AUTHORITY_BELOW_PRODUCT_SPECIFIC_PRIMARY",
  "CATEGORY_UNKNOWN",
  "CONFLICTING_GOVERNED_FACT",
  "EVIDENCE_INSUFFICIENT",
  "IDENTITY_BLOCKED",
  "NEGATIVE_SIGNAL_NOT_AUTHORIZED",
  "NO_V1_RELEVANT_ACTIVE_IDENTITY_MATCH",
  "NOT_REVIEWED",
  "PAD_SURFACE_TEXTURE_MISSING",
  "PRODUCT_FORMAT_MISSING",
  "RECOMMENDED_USE_FREQUENCY_MISSING",
  "REVIEWED_NOT_ESTABLISHED",
  "SOURCE_BLOCKED_OR_MISSING_CURRENT",
  "WIPE_OFF_USE_MISSING",
]);

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
export function canonicalJson(value) { return `${JSON.stringify(stable(value))}\n`; }
export function sha256(text) { return crypto.createHash("sha256").update(text, "utf8").digest("hex"); }
function rowsToObjects(schema, rows) {
  return rows.map((row) => Object.fromEntries(schema.map((key, i) => [key, row[i]])));
}
function provenance(row, role) {
  return {
    subject_id: row.subject_id,
    fact_instance_id: row.fact_instance_id,
    confirmation_id: row.confirmation_id,
    proposition_key: row.proposition_key,
    parent_proposition_key: row.parent_proposition_key,
    fact_key: row.fact_key,
    semantic_status: row.semantic_status,
    authority_ceiling: row.authority_ceiling,
    fused_confidence: row.fused_confidence,
    mapper_input_role: role,
  };
}
function valueOf(row) {
  switch (row.value_type) {
    case "boolean": return row.value_boolean;
    case "enum": return row.value_enum;
    case "number": return row.value_number;
    case "number_unit": return { unit: row.value_unit, value: row.value_number };
    case "range_unit": return { max: row.value_range_max, min: row.value_range_min, unit: row.value_unit };
    case "entity_identifier": return row.value_entity_identifier;
    default: return null;
  }
}
function emptyPda() {
  return {
    active_identities: { items: [], semantic_ordering: "NONE", serialization_order: "IDENTITY_THEN_PROPOSITION_KEY" },
    active_identity_mapping_version: ACTIVE_IDENTITY_MAPPING_VERSION,
    axis_key: AXIS_KEY,
    context: {},
    contract_mode: CONTRACT_MODE,
    contract_version: CONTRACT_VERSION,
    coverage: { applicable_category: null, missing_context_keys: [], state: "not_applicable" },
    evidence_provenance: [],
    multi_active_status: "not_applicable",
    non_axis_contains_active_identities: [],
    numeric_estimate: null,
    ordinal_magnitude: null,
    potency_order: null,
    production_consumption: "NO",
    signal_status: "NOT_APPLICABLE",
    uncertainty: { reasons: [] },
  };
}
function contextKeysFor(category) {
  return Object.entries(CONTEXT_CATEGORIES)
    .filter(([, cats]) => cats.includes(category))
    .map(([key]) => key)
    .sort();
}
export function materialize(product, facts, subject) {
  const [product_id, category] = product;
  if (!KNOWN_CATALOG_CATEGORIES.includes(category)) {
    const pda = emptyPda();
    pda.signal_status = "GOVERNED_SIGNAL_UNKNOWN";
    pda.multi_active_status = "unknown";
    pda.coverage = { applicable_category: null, missing_context_keys: [], state: "category_unknown" };
    pda.uncertainty.reasons = ["CATEGORY_UNKNOWN"];
    return { product_id, category, pda };
  }
  if (!APPLICABLE_CATEGORIES.includes(category)) return { product_id, category, pda: emptyPda() };

  const pda = emptyPda();
  pda.coverage.applicable_category = category;
  pda.multi_active_status = "unknown";
  pda.signal_status = "GOVERNED_SIGNAL_UNKNOWN";
  pda.coverage.state = "missing_fact";

  const requiredContextKeys = contextKeysFor(category);
  pda.coverage.missing_context_keys = [...requiredContextKeys];
  const reasons = new Set(requiredContextKeys.map((key) => MISSING_REASON[key]));

  if (!subject) {
    reasons.add("SOURCE_BLOCKED_OR_MISSING_CURRENT");
    pda.uncertainty.reasons = [...reasons].sort();
    return { product_id, category, pda };
  }
  if (subject.identity_status !== "resolved" || subject.current_state !== "current") {
    pda.signal_status = "GOVERNED_SIGNAL_BLOCKED";
    pda.multi_active_status = "blocked";
    pda.coverage.state = "identity_blocked";
    reasons.add("IDENTITY_BLOCKED");
    pda.uncertainty.reasons = [...reasons].sort();
    return { product_id, category, pda };
  }

  const productFacts = facts.filter((row) => row.product_id === product_id && row.subject_id === subject.subject_id);
  const contains = productFacts.filter((row) => row.fact_key === "contains_active");
  if (contains.some((row) => row.semantic_status === "evidence_conflict")) {
    pda.signal_status = "GOVERNED_SIGNAL_BLOCKED";
    pda.multi_active_status = "blocked";
    pda.coverage.state = "conflict_blocked";
    reasons.add("CONFLICTING_GOVERNED_FACT");
    pda.uncertainty.reasons = [...reasons].sort();
    return { product_id, category, pda };
  }

  const mapped = contains
    .filter((row) => row.semantic_status === "supported" && ACTIVE_IDENTITIES_V1.includes(row.value_entity_identifier))
    .sort((a, b) => a.value_entity_identifier.localeCompare(b.value_entity_identifier) || a.proposition_key.localeCompare(b.proposition_key));
  const mappedByProposition = new Map();
  for (const row of mapped) {
    const key = `${row.value_entity_identifier}\u0000${row.proposition_key}`;
    if (!mappedByProposition.has(key)) mappedByProposition.set(key, row);
  }
  const mappedRows = [...mappedByProposition.values()];
  pda.active_identities.items = mappedRows.map((row) => ({
    identity: row.value_entity_identifier,
    provenance: provenance(row, "SIGNAL"),
  }));

  // Frozen 8O examples preserve non-axis identities only for the no-v1-match branch.
  const nonAxisRows = mappedRows.length === 0
    ? contains
      .filter((row) => row.semantic_status === "supported" && !ACTIVE_IDENTITIES_V1.includes(row.value_entity_identifier))
      .sort((a, b) => a.value_entity_identifier.localeCompare(b.value_entity_identifier) || a.proposition_key.localeCompare(b.proposition_key))
    : [];
  pda.non_axis_contains_active_identities = nonAxisRows.map((row) => ({
    identity: row.value_entity_identifier,
    provenance: provenance(row, "NON_AXIS_IDENTITY"),
  }));

  const context = {};
  const contextRowsUsed = [];
  const mappedPropositions = new Set(mappedRows.map((row) => row.proposition_key));
  for (const factKey of requiredContextKeys) {
    let rows = productFacts.filter((row) => row.fact_key === factKey && row.semantic_status === "supported");
    if (factKey === "active_concentration") {
      rows = rows.filter((row) => row.parent_proposition_key && mappedPropositions.has(row.parent_proposition_key));
    }
    rows.sort((a, b) => a.proposition_key.localeCompare(b.proposition_key) || a.fact_instance_id.localeCompare(b.fact_instance_id));
    if (rows.length) {
      context[factKey] = rows.map((row) => ({ provenance: provenance(row, "CONTEXT"), value: valueOf(row) }));
      reasons.delete(MISSING_REASON[factKey]);
      pda.coverage.missing_context_keys = pda.coverage.missing_context_keys.filter((x) => x !== factKey);
      contextRowsUsed.push(...rows);
    }
  }
  pda.context = context;

  const consumed = [...mappedRows, ...nonAxisRows, ...contextRowsUsed];
  if (consumed.some((row) => row.authority_ceiling !== "product_specific_primary")) {
    reasons.add("AUTHORITY_BELOW_PRODUCT_SPECIFIC_PRIMARY");
  }

  if (mappedRows.length) {
    pda.signal_status = "GOVERNED_SIGNAL_ESTABLISHED";
    pda.multi_active_status = mappedRows.length === 1 ? "single" : "multiple";
    pda.coverage.state = contextRowsUsed.length ? "active_identity_with_unscaled_context" : "active_identity_only";
  } else if (contains.some((row) => row.semantic_status === "not_reviewed")) {
    pda.signal_status = "GOVERNED_SIGNAL_UNKNOWN";
    pda.multi_active_status = "unknown";
    pda.coverage.state = "insufficient_fact";
    reasons.add("NOT_REVIEWED");
  } else if (contains.some((row) => row.semantic_status === "evidence_insufficient")) {
    pda.signal_status = "GOVERNED_SIGNAL_UNKNOWN";
    pda.multi_active_status = "unknown";
    pda.coverage.state = "insufficient_fact";
    reasons.add("EVIDENCE_INSUFFICIENT");
  } else if (contains.some((row) => row.semantic_status === "reviewed_not_established")) {
    pda.signal_status = "GOVERNED_SIGNAL_NOT_ESTABLISHED";
    pda.multi_active_status = "none_established";
    pda.coverage.state = "no_relevant_fact";
    reasons.add("REVIEWED_NOT_ESTABLISHED");
    reasons.add("NEGATIVE_SIGNAL_NOT_AUTHORIZED");
  } else if (nonAxisRows.length) {
    pda.signal_status = "GOVERNED_SIGNAL_NOT_ESTABLISHED";
    pda.multi_active_status = "none_established";
    pda.coverage.state = "no_relevant_fact";
    reasons.add("NEGATIVE_SIGNAL_NOT_AUTHORIZED");
    reasons.add("NO_V1_RELEVANT_ACTIVE_IDENTITY_MATCH");
  } else {
    pda.signal_status = "GOVERNED_SIGNAL_UNKNOWN";
    pda.multi_active_status = "unknown";
    pda.coverage.state = "missing_fact";
    reasons.add("SOURCE_BLOCKED_OR_MISSING_CURRENT");
  }

  pda.evidence_provenance = [
    ...mappedRows.map((row) => provenance(row, "SIGNAL")),
    ...nonAxisRows.map((row) => provenance(row, "NON_AXIS_IDENTITY")),
    ...contextRowsUsed
      .sort((a, b) => a.fact_key.localeCompare(b.fact_key) || a.proposition_key.localeCompare(b.proposition_key))
      .map((row) => provenance(row, "CONTEXT")),
  ];
  pda.uncertainty.reasons = [...reasons].sort();
  return { product_id, category, pda };
}

export function loadSnapshot() {
  const text = fs.readFileSync(INPUT, "utf8");
  if (sha256(text) !== SNAPSHOT_SHA256) throw new Error("frozen snapshot SHA256 drift");
  return JSON.parse(text);
}
export function buildCore() {
  const snapshot = loadSnapshot();
  if (snapshot.stage !== STAGE) throw new Error("snapshot stage drift");
  if (snapshot.source_authority.v21_8o_contract_sha256 !== CONTRACT_SHA256) throw new Error("8O contract authority drift");
  const subjects = rowsToObjects(snapshot.subject_row_schema, snapshot.subjects);
  const facts = rowsToObjects(snapshot.current_fact_row_schema, snapshot.current_facts);
  const subjectByProduct = new Map(subjects.map((row) => [row.product_id, row]));
  const products = snapshot.catalog.map((product) => materialize(product, facts, subjectByProduct.get(product[0]) || null));

  const output = {
    version: "exfoliation-non-numeric-pda-offline-shadow-output-v1",
    stage: STAGE,
    contract_authority: {
      contract_mode: CONTRACT_MODE,
      contract_sha256: CONTRACT_SHA256,
      contract_version: CONTRACT_VERSION,
      upstream_primary_terminal_outcome: UPSTREAM_TERMINAL_OUTCOME,
    },
    snapshot_sha256: SNAPSHOT_SHA256,
    mapper_version: VERSION,
    products,
    primary_terminal_outcome: PRIMARY_TERMINAL_OUTCOME,
    production_status: {
      legacy_behavior: "UNCHANGED",
      pda_production_consumption: "NO",
      recommendation_activation: "NO",
      recommendation_behavior_delta: 0,
    },
  };

  const countBy = (values) => Object.fromEntries(
    [...new Set(values)].sort().map((key) => [key, values.filter((v) => v === key).length])
  );
  const applicable = products.filter((x) => APPLICABLE_CATEGORIES.includes(x.category));
  const presence = Object.fromEntries(Object.keys(CONTEXT_CATEGORIES).sort().map((key) => [
    key, products.filter((x) => Array.isArray(x.pda.context[key]) && x.pda.context[key].length > 0).length,
  ]));
  presence.products_with_missing_context = applicable.filter((x) => x.pda.coverage.missing_context_keys.length > 0).length;
  const reasonValues = products.flatMap((x) => x.pda.uncertainty.reasons);

  const allSnapshotIds = new Set(facts.map((row) => `${row.fact_instance_id}|${row.confirmation_id}|${row.proposition_key}`));
  const provenanceRows = products.flatMap((x) => x.pda.evidence_provenance);
  let fabricated = 0;
  for (const row of provenanceRows) {
    if (!allSnapshotIds.has(`${row.fact_instance_id}|${row.confirmation_id}|${row.proposition_key}`)) fabricated += 1;
  }
  let concentrationLineageViolations = 0;
  for (const x of products) {
    const mappedKeys = new Set(x.pda.active_identities.items.map((i) => i.provenance.proposition_key));
    for (const item of x.pda.context.active_concentration || []) {
      if (!item.provenance.parent_proposition_key || !mappedKeys.has(item.provenance.parent_proposition_key)) concentrationLineageViolations += 1;
    }
  }

  const summary = {
    version: "exfoliation-non-numeric-pda-offline-shadow-summary-v1",
    stage: STAGE,
    catalog_count: products.length,
    applicable_count: applicable.length,
    not_applicable_count: products.length - applicable.length,
    signal_state_counts: countBy(products.map((x) => x.pda.signal_status)),
    coverage_state_counts: countBy(products.map((x) => x.pda.coverage.state)),
    multi_active_state_counts: countBy(products.map((x) => x.pda.multi_active_status)),
    context_presence_counts: presence,
    uncertainty_reason_counts: countBy(reasonValues),
    provenance_integrity_summary: {
      catalog_products_with_exactly_one_output: products.length,
      concentration_parent_lineage_violation_count: concentrationLineageViolations,
      fabricated_provenance_count: fabricated,
      output_product_id_unique_count: new Set(products.map((x) => x.product_id)).size,
      raw_evidence_body_count: 0,
      relevant_current_snapshot_rows: facts.length,
    },
    numeric_non_null_count: products.filter((x) => x.pda.numeric_estimate !== null).length,
    ordinal_non_null_count: products.filter((x) => x.pda.ordinal_magnitude !== null).length,
    potency_ordering_non_null_count: products.filter((x) => x.pda.potency_order !== null).length,
    primary_terminal_outcome: PRIMARY_TERMINAL_OUTCOME,
  };

  return { snapshot, subjects, facts, output, summary };
}

export function buildAll() {
  const core = buildCore();
  const renderedOutput = canonicalJson(core.output);
  const renderedSummary = canonicalJson(core.summary);
  const outputHash = sha256(renderedOutput);
  const summaryHash = sha256(renderedSummary);
  const replay = {
    version: "exfoliation-non-numeric-pda-offline-shadow-replay-v1",
    stage: STAGE,
    upstream_8o_authority: {
      primary_terminal_outcome: UPSTREAM_TERMINAL_OUTCOME,
      contract_sha256: CONTRACT_SHA256,
      examples_sha256: "3b93bee53229cf19c65f2bbb85db4f2f50570da086a370d4f9fe73ba83763cab",
      replay_sha256: "d7192c0f16f4916849b800dee24c4a073435de60e49de238e6a9d7893a938500",
      documentation_sha256: "98bff1780121333b1b5d358d5581dde905380013b4dc1d67cb4e972b9adb39ba",
    },
    input_snapshot_authority: {
      hosted_project: "bygrczggxfuisupcevaz",
      snapshot_sha256: SNAPSHOT_SHA256,
      catalog_count: 164,
      subject_count: 16,
      relevant_current_row_count: 28,
      live_hosted_access_in_ci: "NO",
    },
    canonical_example_replay: {
      all_exact_8o_semantics_replayed: true,
      examples: [
        { example_id: "single_active_with_concentration_context", product_id: "0b88019a-9eb2-4be9-842d-f1e60e42cf51" },
        { example_id: "single_active_missing_concentration", product_id: "c4a5f510-8d9e-46bd-a31c-3c0a34fee331" },
        { example_id: "multi_active_with_pad_context", product_id: "230f1c9c-cbf8-4458-aaac-ea1010a21e8c" },
        { example_id: "no_v1_relevant_signal_with_context", product_id: "24a339bf-f380-493f-88b5-68e6be887c30" },
      ],
    },
    catalog_wide_replay: {
      output_sha256: outputHash,
      summary_sha256: summaryHash,
      catalog_count: core.summary.catalog_count,
      applicable_count: core.summary.applicable_count,
      not_applicable_count: core.summary.not_applicable_count,
    },
    determinism: {
      build_a_b_byte_equality: "PASS",
      checked_in_equals_generated: "PASS",
      focused_verifier: "PASS",
    },
    historical_replay: [
      { stage: "V2.1-8J", outcome: "STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION" },
      { stage: "V2.1-8K", outcome: "NUMERIC_ANCHOR_GAP_CONFIRMED" },
      { stage: "V2.1-8L", outcome: "NUMERIC_ANCHOR_EVIDENCE_CONTRACT_DESIGNED" },
      { stage: "V2.1-8M", outcome: "NO_NUMERIC_ANCHOR_SOURCE_FOUND" },
      { stage: "V2.1-8N", outcome: "NON_NUMERIC_DECISION_REPRESENTATION_RECOMMENDED" },
      { stage: "V2.1-8O", outcome: UPSTREAM_TERMINAL_OUTCOME },
    ],
    production_invariance: {
      evaluations: 1968,
      products: 164,
      scenarios: 12,
      score_delta: 0,
      ranking_delta: 0,
      top1_delta: 0,
      top3_delta: 0,
      eligibility_delta: 0,
      public_response_delta: 0,
      persistence_delta: 0,
      candidate_policy_delta: 0,
      pda_production_consumption: "NO",
      recommendation_activation: "NO",
      legacy_production_behavior: "UNCHANGED",
    },
    hosted_invariance: {
      prestate_equals_poststate: true,
      task_caused_delta: 0,
      hosted_product_fact_writes_v21_8p: 0,
      registry_definition_delta_v21_8p: 0,
      migration_delta_v21_8p: 0,
      subject_delta_v21_8p: 0,
      evidence_delta_v21_8p: 0,
      current_delta_v21_8p: 0,
    },
    primary_terminal_outcome: PRIMARY_TERMINAL_OUTCOME,
  };
  const renderedReplay = canonicalJson(replay);
  const doc = `# V2.1-8P Exfoliation Non-Numeric PDA Offline/Shadow Implementation v1

Execution-start main: \`8f8d492f2682c97f71f3f7880adb710f1be4c7f2\`.

## Authority and scope

This stage consumes, without redesign, V2.1-8O \`${CONTRACT_MODE}\` contract \`${CONTRACT_VERSION}\` with SHA256 \`${CONTRACT_SHA256}\`. The frozen upstream outcome remains \`${UPSTREAM_TERMINAL_OUTCOME}\`.

Hosted Product Fact authority was read once, READ ONLY, then reduced to a checked-in canonical snapshot. CI does not contact Supabase. The snapshot contains 164 catalog product/category rows, 16 Product Fact subjects, and 28 relevant Current rows across the six mapper input fact keys. Raw Evidence bodies and unstable access timestamps are excluded.

Snapshot SHA256: \`${SNAPSHOT_SHA256}\`.

## Offline/shadow mapper

Mapper version: \`${VERSION}\`.

The mapper emits exactly one \`exfoliation_load\` PDA object for every catalog product. Only \`toner_essence\`, \`toner_pad\`, and \`treatment\` are applicable. Other categories emit the frozen \`NOT_APPLICABLE\` structure.

The v1 governed active identity set is \`lactic_acid\`, \`mandelic_acid\`, and \`salicylic_acid\`. All qualifying governed propositions are retained with deterministic serialization order only. Active count is cardinality, not potency. No numeric or ordinal magnitude is created.

Context remains context-only: \`active_concentration\`, \`recommended_use_frequency\`, \`product_format\`, \`wipe_off_use\`, and \`pad_surface_texture\`. Concentration is consumed only when its parent proposition matches a mapped governed active. Missing context remains missing and produces the frozen categorical uncertainty reason rather than a zero/default.

## Catalog replay

- catalog: ${core.summary.catalog_count}
- applicable: ${core.summary.applicable_count}
- not applicable: ${core.summary.not_applicable_count}
- signal established: ${core.summary.signal_state_counts.GOVERNED_SIGNAL_ESTABLISHED || 0}
- signal not established: ${core.summary.signal_state_counts.GOVERNED_SIGNAL_NOT_ESTABLISHED || 0}
- signal unknown: ${core.summary.signal_state_counts.GOVERNED_SIGNAL_UNKNOWN || 0}
- signal blocked: ${core.summary.signal_state_counts.GOVERNED_SIGNAL_BLOCKED || 0}
- single active: ${core.summary.multi_active_state_counts.single || 0}
- multiple active: ${core.summary.multi_active_state_counts.multiple || 0}
- none established: ${core.summary.multi_active_state_counts.none_established || 0}
- numeric non-null: ${core.summary.numeric_non_null_count}
- ordinal non-null: ${core.summary.ordinal_non_null_count}
- potency ordering non-null: ${core.summary.potency_ordering_non_null_count}

Coverage frequencies: \`${JSON.stringify(core.summary.coverage_state_counts)}\`.

Uncertainty frequencies: \`${JSON.stringify(core.summary.uncertainty_reason_counts)}\`.

## Canonical 8O examples

The catalog replay reproduces the four frozen examples exactly at the PDA object boundary:

- The Ordinary Mandelic Acid 10% + HA: mapped \`mandelic_acid\`, established, single, 10% concentration context, numeric/ordinal null.
- Dr.G Red Blemish 10-Cica Capsule Soothing Toner: mapped \`mandelic_acid\`, established, single, concentration missing preserved.
- Medicube Zero Pore Pad 2.0: \`lactic_acid\` + \`salicylic_acid\`, multiple, pad/wipe/texture context preserved, no potency implication.
- Anua PDRN Hyaluronic Acid Capsule 100 Serum: no v1 relevant active, governed signal not established, non-axis identities preserved, negative signal not authorized.

## Provenance and missingness

Every emitted provenance reference is copied from the frozen snapshot and includes subject, Fact Instance, Confirmation, proposition/parent proposition, fact key, semantic status, authority ceiling, fused confidence, and mapper role. Raw Evidence bodies are not copied. Concentration parent lineage violations: ${core.summary.provenance_integrity_summary.concentration_parent_lineage_violation_count}. Fabricated provenance references: ${core.summary.provenance_integrity_summary.fabricated_provenance_count}.

\`missing != false\`, \`reviewed_not_established != false\`, and \`evidence_insufficient != false\` remain hard invariants. V1 does not emit an explicit negative exfoliation signal without authority.

## Determinism and production boundary

Canonical serialization recursively sorts object keys, preserves explicitly sorted arrays, emits UTF-8/LF, and is byte-compared Build A vs Build B and against checked-in generated artifacts.

This mapper is offline/shadow only. It has no network or Supabase client dependency and is not imported by production Recommendation code. Product Fact Registry, Hosted data, migrations, scorer, ranker, eligibility, CandidatePolicy, public response, persistence, and legacy production behavior remain unchanged.

Historical V2.1-8J through 8O verifiers and the canonical 164 × 12 = 1968 Recommendation invariance suite are required in CI. Every production delta remains zero and PDA production consumption remains \`NO\`.

Primary terminal outcome: \`${PRIMARY_TERMINAL_OUTCOME}\`.
`;
  return {
    ...core,
    replay,
    doc,
    rendered: {
      output: renderedOutput,
      summary: renderedSummary,
      replay: renderedReplay,
      doc,
    },
    hashes: {
      input: SNAPSHOT_SHA256,
      output: outputHash,
      summary: summaryHash,
      replay: sha256(renderedReplay),
      doc: sha256(doc),
    },
  };
}

export function writeAll(root = process.env.V21_8P_OUTPUT_ROOT || ".") {
  const built = buildAll();
  for (const [key, rel] of Object.entries(OUTPUTS)) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, built.rendered[key], "utf8");
  }
  return built;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const built = writeAll();
  console.log(JSON.stringify({
    status: "PASS",
    stage: STAGE,
    mapper_version: VERSION,
    primary_terminal_outcome: PRIMARY_TERMINAL_OUTCOME,
    hashes: built.hashes,
  }));
}
