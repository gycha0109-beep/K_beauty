#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_READ_CONTRACT_VERSION,
  normalizeRecommendationSunscreenProtectionAuthorityPayload,
  isProtectionFactRankingAuthorityEligible
} from "../lib/recommendation-sunscreen-protection-authority-contract.mjs";

const migration = fs.readFileSync(
  "supabase/migrations/20260929083000_data_ai29c_sunscreen_protection_authority_v1.sql",
  "utf8"
);
const reader = fs.readFileSync(
  "lib/recommendation-sunscreen-protection-authority-reader.js",
  "utf8"
);
const execution = fs.readFileSync(
  "lib/product-query-execution-contract.mjs",
  "utf8"
);
const recommendation = fs.readFileSync(
  "lib/product-query-recommendation.js",
  "utf8"
);

const productId = "00000000-0000-4000-8000-000000000001";
const subjectId = "00000000-0000-4000-8000-000000000101";
const registryVersion = "product-fact-registry-cross-category-v1";
const registryChecksum = "a".repeat(64);

function fact({
  factKey,
  idSuffix,
  valueType,
  valueNumber = null,
  valueUnit = null,
  valueEnum = null,
  qualifier = {},
  market = "KR",
  semanticStatus = "supported",
  authorityCeiling = "product_specific_primary",
  fusedConfidence = "high"
}) {
  return {
    proposition_key: String(idSuffix).padStart(64, "b").slice(-64),
    fact_instance_id: \`00000000-0000-4000-8000-\${String(idSuffix).padStart(12, "0")}\`,
    subject_id: subjectId,
    confirmation_id: \`00000000-0000-4000-9000-\${String(idSuffix).padStart(12, "0")}\`,
    fact_key: factKey,
    registry_version: registryVersion,
    proposition_serializer_version: "product-fact-proposition-v1",
    semantic_status: semanticStatus,
    value_type: valueType,
    value_number: valueNumber,
    value_unit: valueUnit,
    value_enum: valueEnum,
    market,
    region: null,
    locale: null,
    qualifier,
    authority_ceiling: authorityCeiling,
    fused_confidence: fusedConfidence,
    valid_from: null,
    valid_to: null
  };
}

function payload(currentFacts) {
  return {
    read_contract_version:
      RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_READ_CONTRACT_VERSION,
    status: "AUTHORITY_RESOLVED",
    product: {
      product_id: productId,
      category: "sunscreen"
    },
    subject: {
      subject_id: subjectId,
      product_id: productId,
      subject_identity_serializer_version: "product-fact-subject-v1",
      identity_status: "resolved",
      identity_resolution_version: "product-fact-identity-v1",
      current_state: "current",
      market_applicability: "KR",
      region_applicability: null,
      valid_from: null,
      valid_to: null
    },
    registry: {
      registry_version: registryVersion,
      registry_checksum: registryChecksum,
      identity_serializer_version: "product-fact-subject-v1"
    },
    current_facts: currentFacts
  };
}

const valid = payload([
  fact({
    factKey: "spf_value",
    idSuffix: 1,
    valueType: "number",
    valueNumber: 50,
    qualifier: { plus_modifier: "plus" }
  }),
  fact({
    factKey: "uva_label",
    idSuffix: 2,
    valueType: "enum",
    valueEnum: "PA++++"
  }),
  fact({
    factKey: "water_resistance_duration",
    idSuffix: 3,
    valueType: "number_unit",
    valueNumber: 80,
    valueUnit: "minutes",
    qualifier: {
      metric: "water_resistance",
      method_context: "declared",
      timepoint: "duration"
    }
  })
]);

const normalized =
  normalizeRecommendationSunscreenProtectionAuthorityPayload(valid);
assert.equal(normalized.status, "AUTHORITY_RESOLVED");
assert.equal(normalized.authority.currentFacts.length, 3);
assert.ok(
  normalized.authority.currentFacts.every(isProtectionFactRankingAuthorityEligible)
);

const duplicate = structuredClone(valid);
duplicate.current_facts[2] = structuredClone(duplicate.current_facts[0]);
duplicate.current_facts[2].fact_instance_id =
  "00000000-0000-4000-8000-000000000099";
duplicate.current_facts[2].confirmation_id =
  "00000000-0000-4000-9000-000000000099";
duplicate.current_facts[2].proposition_key = "c".repeat(64);
assert.equal(
  normalizeRecommendationSunscreenProtectionAuthorityPayload(duplicate).reason,
  "AMBIGUOUS_CURRENT_FACT_KEY"
);

const nonSunscreen = structuredClone(valid);
nonSunscreen.product.category = "cleanser";
assert.equal(
  normalizeRecommendationSunscreenProtectionAuthorityPayload(nonSunscreen).reason,
  "NON_SUNSCREEN_PRODUCT"
);

const malformedSpf = structuredClone(valid);
malformedSpf.current_facts[0].value_number = null;
assert.equal(
  normalizeRecommendationSunscreenProtectionAuthorityPayload(malformedSpf).reason,
  "MALFORMED_SPF_VALUE"
);

const malformedWater = structuredClone(valid);
malformedWater.current_facts[2].value_unit = "hours";
assert.equal(
  normalizeRecommendationSunscreenProtectionAuthorityPayload(malformedWater).reason,
  "MALFORMED_WATER_VALUE_FIELDS"
);

const unsupported = structuredClone(valid);
unsupported.current_facts[0].semantic_status = "evidence_insufficient";
const unsupportedNormalized =
  normalizeRecommendationSunscreenProtectionAuthorityPayload(unsupported);
assert.equal(unsupportedNormalized.status, "AUTHORITY_RESOLVED");
assert.equal(
  isProtectionFactRankingAuthorityEligible(
    unsupportedNormalized.authority.currentFacts[0]
  ),
  false
);

assert.match(migration, /security definer/i);
assert.match(migration, /set search_path = ''/i);
assert.match(
  migration,
  /read_recommendation_sunscreen_protection_authority_v1/
);
assert.match(
  migration,
  /i\.fact_key in \([\s\S]*'spf_value'[\s\S]*'uva_label'[\s\S]*'water_resistance_duration'[\s\S]*\)/
);
assert.match(
  migration,
  /revoke all privileges on public\.product_evidence_records from recommendation_protection_runtime/i
);
assert.match(
  migration,
  /DATA_AI29C_RUNTIME_RAW_PF_SELECT_FORBIDDEN/
);
assert.match(
  migration,
  /grant execute on function public\.read_recommendation_sunscreen_protection_authority_v1\(uuid\)[\s\S]*to recommendation_protection_runtime/i
);
assert.doesNotMatch(
  migration,
  /grant\s+select[\s\S]{0,160}to recommendation_protection_runtime/i
);
assert.doesNotMatch(migration, /password\s+['"][^'"]+['"]/i);

assert.match(reader, /import\s+"server-only"/);
assert.match(reader, /RECOMMENDATION_PROTECTION_DATABASE_URL/);
assert.match(reader, /recommendation_protection_runtime/);
assert.match(
  reader,
  /read_recommendation_sunscreen_protection_authority_v1/
);
assert.match(reader, /prepare:\s*false/);
assert.match(reader, /max:\s*1/);
assert.doesNotMatch(reader, /NEXT_PUBLIC_/);
assert.doesNotMatch(reader, /console\.(log|warn|error)/);

assert.doesNotMatch(
  execution,
  /recommendation-sunscreen-protection-authority-reader/
);
assert.doesNotMatch(
  recommendation,
  /recommendation-sunscreen-protection-authority-reader/
);
assert.equal(
  execution.includes('signals.push("outdoor_exposure")'),
  false,
  "DATA-AI29C-A must not authorize outdoor_exposure as a rankable signal"
);

console.log(
  "DATA-AI29C-A sunscreen protection authority verifier: PASS"
);
