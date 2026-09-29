import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildGroupedRelocationPhase8hAnchorBridge,
} from "../lib/trust/official-source-grouped-relocation-phase8h-anchor-bridge.mjs";

const fixture = JSON.parse(
  fs.readFileSync(
    "docs/evidence/trust-phase8i4-grouped-relocation-synthetic-fixture-v1.json",
    "utf8",
  ),
);
const bridgeSource = fs.readFileSync(
  "lib/trust/official-source-grouped-relocation-phase8h-anchor-bridge.mjs",
  "utf8",
);
const groupedConfirmationSource = fs.readFileSync(
  "lib/trust/official-source-grouped-relocation-confirmation-request.mjs",
  "utf8",
);
const contract = fs.readFileSync(
  "docs/evidence/trust-phase8i4-grouped-relocation-confirmation-contract-v1.md",
  "utf8",
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const bridge = buildGroupedRelocationPhase8hAnchorBridge(fixture);

assert.equal(
  bridge.contract,
  "trust-phase8i4-phase8h-anchor-bridge-v1",
);
assert.equal(
  bridge.authority,
  "BRIDGE_ONLY_REQUIRES_FUTURE_DATABASE_GROUP_REVALIDATION",
);
assert.equal(
  bridge.grouped_preflight.status,
  "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION",
);
assert.equal(
  bridge.qualified_historical_source_id,
  fixture.evaluation.qualified_historical_source_id,
);
assert.equal(
  bridge.phase8h_anchor_preflight.status,
  "READY_FOR_ADMIN_RELOCATION_CONFIRMATION",
);
assert.equal(
  bridge.phase8h_anchor_preflight.historical_source_id,
  fixture.evaluation.qualified_historical_source_id,
);
assert.equal(
  bridge.phase8h_anchor_preflight.old_binding_id,
  fixture.current_reviewed_binding.binding_id,
);
assert.match(
  bridge.phase8h_anchor_preflight.prestate_digest,
  /^[0-9a-f]{64}$/,
);
assert.match(
  bridge.phase8h_anchor_preflight.relocation_plan_digest,
  /^[0-9a-f]{64}$/,
);
assert.equal(
  bridge.phase8h_anchor_confirmation_request.contract,
  "trust-phase8h-governed-relocation-confirmation-request-v1",
);
assert.equal(
  bridge.phase8h_anchor_confirmation_request.historical_source_id,
  bridge.qualified_historical_source_id,
);
assert.equal(
  bridge.phase8h_anchor_confirmation_request.expected_prestate_digest,
  bridge.phase8h_anchor_preflight.prestate_digest,
);
assert.equal(
  bridge.phase8h_anchor_confirmation_request.relocation_plan_digest,
  bridge.phase8h_anchor_preflight.relocation_plan_digest,
);
assert.equal(
  bridge.phase8h_anchor_confirmation_request.replacement.source_url,
  fixture.replacement.source_url,
);

const reordered = clone(fixture);
reordered.case.historical_source_ids.reverse();
reordered.case.incident_ids.reverse();
reordered.historical_sources.reverse();
const reorderedBridge =
  buildGroupedRelocationPhase8hAnchorBridge(reordered);
assert.equal(
  reorderedBridge.grouped_preflight.group_prestate_digest,
  bridge.grouped_preflight.group_prestate_digest,
);
assert.equal(
  reorderedBridge.grouped_preflight.group_plan_digest,
  bridge.grouped_preflight.group_plan_digest,
);
assert.equal(
  reorderedBridge.phase8h_anchor_preflight.prestate_digest,
  bridge.phase8h_anchor_preflight.prestate_digest,
);
assert.equal(
  reorderedBridge.phase8h_anchor_preflight.relocation_plan_digest,
  bridge.phase8h_anchor_preflight.relocation_plan_digest,
);

const wrongAnchorMetadata = clone(fixture);
const anchorRow = wrongAnchorMetadata.historical_sources.find(
  (row) =>
    row.source_id ===
    wrongAnchorMetadata.evaluation.qualified_historical_source_id,
);
anchorRow.canonical_locator =
  "https://beautyofjoseon.com/products/tampered-old-source";
assert.throws(
  () => buildGroupedRelocationPhase8hAnchorBridge(wrongAnchorMetadata),
  /TRUST_PHASE8I4_ANCHOR_BRIDGE_GROUPED_PREFLIGHT_NOT_READY/,
);

const wrongQualifiedSourceKind = clone(fixture);
wrongQualifiedSourceKind.evaluation.qualified_exact.candidate_source_kind =
  "brand_official_faq";
assert.throws(
  () =>
    buildGroupedRelocationPhase8hAnchorBridge(
      wrongQualifiedSourceKind,
    ),
  /TRUST_PHASE8I4_ANCHOR_BRIDGE_GROUPED_PREFLIGHT_NOT_READY/,
);

const wrongQualificationSource = clone(fixture);
wrongQualificationSource.evaluation.qualified_exact.historical_source_id =
  wrongQualificationSource.historical_sources[1].source_id;
assert.throws(
  () =>
    buildGroupedRelocationPhase8hAnchorBridge(
      wrongQualificationSource,
    ),
  /TRUST_PHASE8I4_ANCHOR_BRIDGE_GROUPED_PREFLIGHT_NOT_READY/,
);

for (const required of [
  "preflightGroupedOfficialSourceRelocation",
  "preflightOfficialSourceRelocation",
  "buildOfficialSourceRelocationConfirmationRequest",
  "BRIDGE_ONLY_REQUIRES_FUTURE_DATABASE_GROUP_REVALIDATION",
]) {
  assert.ok(
    bridgeSource.includes(required),
    "anchor bridge missing: " + required,
  );
}

for (const required of [
  "phase8h_anchor_prestate_digest",
  "phase8h_anchor_relocation_plan_digest",
  "phase8h_anchor_confirmation_request",
]) {
  assert.ok(
    groupedConfirmationSource.includes(required),
    "grouped confirmation missing bridge field: " + required,
  );
}

for (const required of [
  "trust-phase8h-governed-relocation-confirmation-request-v1",
  "admin_confirm_trust_official_source_relocation_v1",
  "same database transaction",
  "entire outer transaction must roll back",
]) {
  assert.ok(contract.includes(required), "contract missing: " + required);
}

for (const source of [bridgeSource, groupedConfirmationSource]) {
  for (const forbidden of [
    "@supabase/supabase-js",
    ".from(",
    ".rpc(",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      "bridge/request must remain database-free: " + forbidden,
    );
  }
}

console.log(
  JSON.stringify(
    {
      contract:
        "trust-phase8i4-phase8h-anchor-bridge-verification-v1",
      result: "PASS",
      qualified_historical_source_id:
        bridge.qualified_historical_source_id,
      grouped_prestate_digest:
        bridge.grouped_preflight.group_prestate_digest,
      grouped_plan_digest:
        bridge.grouped_preflight.group_plan_digest,
      phase8h_prestate_digest:
        bridge.phase8h_anchor_preflight.prestate_digest,
      phase8h_relocation_plan_digest:
        bridge.phase8h_anchor_preflight.relocation_plan_digest,
      authority: bridge.authority,
    },
    null,
    2,
  ),
);
