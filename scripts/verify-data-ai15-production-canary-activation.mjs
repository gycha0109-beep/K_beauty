#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_PRODUCTION_CANARY_ACCEPTANCE_EVIDENCE as evidence
} from "../lib/product-query-production-canary-acceptance-evidence.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(evidence.evidenceVersion ===
    "product-query-production-canary-acceptance-evidence-v1" &&
    evidence.phase === "DATA-AI15" &&
    evidence.accepted === true,
  "DATA-AI15 historical acceptance evidence must be frozen");

check(evidence.activationSha === "8348adef50944f957cf17df61e2f92b31c1ccdd6" &&
    evidence.workflowRunId === 35588622637 &&
    evidence.workflowJobId === 106297698065,
  "DATA-AI15 exact GitHub execution identity must be frozen");

check(evidence.deployment?.id === "dpl_5gBSLD2iCHYxryadHtbqMqog2fux" &&
    evidence.deployment?.host === "k-beauty-2a5lw0hhw-johnny-self.vercel.app" &&
    evidence.deployment?.environment === "production" &&
    evidence.deployment?.state === "READY",
  "DATA-AI15 exact successful Production deployment must be frozen");

check(evidence.activationWindow?.startUtc === "2026-09-21T10:19:00Z" &&
    evidence.activationWindow?.endUtc === "2026-09-21T16:19:00Z" &&
    evidence.activationWindow?.durationMinutes === 360,
  "DATA-AI15 activation window must remain the approved six hours");

check(evidence.runtime?.authenticatedCredentialMatchedApprovedSubject === true &&
    evidence.runtime?.effectiveSampleBps === 1 &&
    evidence.runtime?.manualOnly === true &&
    evidence.runtime?.automaticTrafficSampling === false &&
    evidence.runtime?.publicSearchCutover === false &&
    evidence.runtime?.persisted === false &&
    evidence.runtime?.responseContract === "product-query-production-canary-v1" &&
    evidence.runtime?.httpAccepted === true,
  "DATA-AI15 accepted runtime boundary must remain exact");

check(evidence.privacy?.rawSubjectRecorded === false &&
    evidence.privacy?.rawTokenRecorded === false &&
    evidence.privacy?.rawQueryPersisted === false,
  "DATA-AI15 privacy evidence must remain non-secret/non-persistent");

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const env = config?.env || {};
for (const key of [
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_RUNTIME_AUTHORIZED",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_ACCOUNT_HASHES",
  "BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS"
]) {
  check(!Object.hasOwn(env, key),
    `temporary DATA-AI15 activation key must be absent after closure: ${key}`);
}

console.log(`DATA-AI15 historical Production canary acceptance verifier: PASS (${assertions} assertions)`);
