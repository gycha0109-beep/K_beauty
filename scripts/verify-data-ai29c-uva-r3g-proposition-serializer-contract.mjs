#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PRODUCT_FACT_PROPOSITION_SERIALIZER_V2,
  buildProductFactPropositionIdentityV2,
  productFactPropositionKeyV2,
} from "../lib/product-fact-proposition-schema-v2.mjs";

const r3a = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3a-broad-spectrum-semantic-contract-v1.json",
    "utf8",
  ),
);
const r3g = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3g-proposition-serializer-contract-v1.json",
    "utf8",
  ),
);

const definition = {
  ...r3a.proposedFactDefinition,
  registry_version: "product-fact-registry-cross-category-v2",
};

const base = {
  definition,
  subjectSemanticKey: r3g.dayDewPilotIdentity.subjectSemanticKey,
  registryVersion: r3g.dayDewPilotIdentity.registryVersion,
  factKey: "broad_spectrum",
  scope: { market: "US" },
  qualifier: {},
  parentPropositionKey: null,
};

assert.equal(
  PRODUCT_FACT_PROPOSITION_SERIALIZER_V2,
  "product-fact-proposition-schema-v2",
);

const trueIdentity = buildProductFactPropositionIdentityV2({
  ...base,
  valueIdentity: true,
});
const falseIdentity = buildProductFactPropositionIdentityV2({
  ...base,
  valueIdentity: false,
});

assert.equal(trueIdentity.value_identity, null);
assert.equal(falseIdentity.value_identity, null);
assert.deepEqual(trueIdentity, falseIdentity);

const trueKey = productFactPropositionKeyV2({
  ...base,
  valueIdentity: true,
});
const falseKey = productFactPropositionKeyV2({
  ...base,
  valueIdentity: false,
});

assert.equal(
  trueKey,
  "e653ba036940662aa2e5aad8dd008d1194814923fa72a5cd088a0b585fb6199b",
);
assert.equal(falseKey, trueKey);
assert.equal(r3g.dayDewPilotIdentity.propositionKey, trueKey);
assert.equal(r3g.dayDewPilotIdentity.valueIdentity, null);
assert.equal(r3g.dayDewPilotIdentity.trueAndFalseShareSamePropositionKey, true);

assert.equal(
  r3g.discovery.registryContractExample.knownPropositionKey,
  r3g.discovery.registryContractExample.recomputedWithTrue,
);
assert.notEqual(
  r3g.discovery.registryContractExample.knownPropositionKey,
  r3g.discovery.registryContractExample.recomputedWithNull,
);

assert.equal(r3g.failClosedAction.policyState, "blocked");
assert.equal(r3g.failClosedAction.newLineageAllowed, false);
assert.equal(r3g.failClosedAction.existingLineageAllowed, false);
assert.equal(r3g.failClosedAction.broadEvidenceCountAtLock, 0);
assert.equal(r3g.failClosedAction.broadFactCountAtLock, 0);

assert.equal(r3g.rollbackPilot.evidenceIngested, true);
assert.equal(r3g.rollbackPilot.confirmationPreflightReady, true);
assert.equal(r3g.rollbackPilot.confirmationSucceeded, true);
assert.equal(r3g.rollbackPilot.currentFactCountInsideTransaction, 93);
assert.equal(r3g.rollbackPilot.broadCurrentTrueInsideTransaction, true);
assert.equal(r3g.rollbackPilot.rolledBack, true);

assert.equal(r3g.productionReadbackAfterRollback.policyState, "blocked");
assert.equal(r3g.productionReadbackAfterRollback.broadEvidenceCount, 0);
assert.equal(r3g.productionReadbackAfterRollback.broadOpenReviewCount, 0);
assert.equal(r3g.productionReadbackAfterRollback.broadFactCount, 0);
assert.equal(r3g.productionReadbackAfterRollback.broadCurrentCount, 0);
assert.equal(r3g.productionReadbackAfterRollback.currentFactCount, 92);

assert.equal(r3g.recommendationBoundary.broadSpectrumConsumed, false);
assert.equal(r3g.recommendationBoundary.rankingChanged, false);
assert.equal(r3g.recommendationBoundary.publicActivation, false);

assert.equal(
  r3g.decision,
  "UVA_R3G_PROPOSITION_SERIALIZER_SCHEMA_V2_PASS_POLICY_LOCKED",
);
assert.equal(
  r3g.nextGate,
  "DATA-AI29C-UVA-R3H_DAY_DEW_BROAD_SPECTRUM_GOVERNED_FACT_PILOT",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: r3g.stage,
    serializer: PRODUCT_FACT_PROPOSITION_SERIALIZER_V2,
    propositionKey: trueKey,
    trueFalseSameKey: trueKey === falseKey,
    policyState: r3g.productionReadbackAfterRollback.policyState,
    decision: r3g.decision,
  }),
);
