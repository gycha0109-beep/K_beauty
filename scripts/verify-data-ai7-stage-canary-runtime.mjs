#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  evaluateProductQueryStageCanaryPolicy
} from "../lib/product-query-stage-canary-policy.mjs";
import {
  executeProductQueryStageCanaryCore
} from "../lib/product-query-stage-canary-core.mjs";

const policy = evaluateProductQueryStageCanaryPolicy({
  BEJEWELY_PRODUCT_QUERY_STAGE_CANARY_ENABLED: "true",
  NODE_ENV: "test"
});

assert.equal(policy.allowed, true, "test-equivalent DATA-AI7 policy must activate");

const query = "지성인데 백탁 없고 안 끈적이는 선크림 찾아줘";
let calls = 0;
const stablePreview = Object.freeze({
  contractVersion: "product-query-preview-v1",
  status: "ranked",
  effectiveCategory: "sunscreen",
  constraintStatus: "resolved",
  unresolvedTerms: Object.freeze([]),
  results: Object.freeze([
    Object.freeze({
      id: "fixture-sun-1",
      brand: "Fixture",
      name: "Stable Sun",
      category: "sunscreen",
      whyPicked: Object.freeze(["fixture"]),
      cautionNote: null
    }),
    Object.freeze({
      id: "fixture-sun-2",
      brand: "Fixture",
      name: "Second Sun",
      category: "sunscreen",
      whyPicked: Object.freeze(["fixture"]),
      cautionNote: null
    })
  ]),
  persisted: false
});

const canary = await executeProductQueryStageCanaryCore(query, {
  executePreview: async (receivedQuery) => {
    calls += 1;
    assert.equal(receivedQuery, query, "canary must forward the exact normalized caller query to its preview executor");
    return stablePreview;
  }
});

assert.equal(calls, 2, "DATA-AI7 must execute exactly two repetitions");
assert.equal(canary.repetitions, 2);
assert.equal(canary.allParity, true);
assert.deepEqual(canary.parity, {
  status: true,
  effectiveCategory: true,
  constraintStatus: true,
  unresolvedTerms: true,
  resultOrder: true
});
assert.equal(canary.preview, stablePreview, "first bounded preview must be the projected canary result");
assert.equal(canary.persisted, false);
assert.equal(canary.evidenceRetention, "request_local_only");
assert.equal(JSON.stringify(canary).includes(query), false, "runtime evidence must not echo the raw query");

let driftCalls = 0;
const drift = await executeProductQueryStageCanaryCore(query, {
  executePreview: async () => {
    driftCalls += 1;
    if (driftCalls === 1) return stablePreview;
    return {
      ...stablePreview,
      results: [
        {
          ...stablePreview.results[1]
        },
        {
          ...stablePreview.results[0]
        }
      ]
    };
  }
});

assert.equal(driftCalls, 2);
assert.equal(drift.allParity, false, "result-order drift must fail repeatability parity");
assert.equal(drift.parity.resultOrder, false);

console.log("DATA-AI7 stage canary runtime harness: PASS");
