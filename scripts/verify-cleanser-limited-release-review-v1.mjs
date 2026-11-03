#!/usr/bin/env node
import assert from "node:assert/strict";
import {
 CHECKS,evaluateCleanserLimitedReleaseReviewV1 as review
} from "../lib/trust/cleanser-limited-release-review-v1.mjs";
const base=review();
assert.equal(base.checks_required,12);
assert.equal(base.checks_reported_complete,0);
assert.equal(base.decision,"LIMITED_RELEASE_HOLD");
assert.equal(base.manufacturer_direct_reply_required,false);
assert.equal(base.full_governed_fact_checklist_substituted,false);
const partial=review({evidence:{frozen_legacy_recommendation_semantics_passed:true}});
assert.equal(partial.checks_reported_complete,1);
assert.equal(partial.missing.length,11);
assert.equal(partial.limited_runtime_admission_granted,false);
const full=Object.fromEntries(CHECKS.map(([key])=>[key,true]));
const complete=review({evidence:full});
assert.equal(complete.checks_reported_complete,12);
assert.equal(complete.decision,"INDEPENDENT_PROTECTED_OWNER_REVIEW_REQUIRED");
assert.equal(complete.limited_runtime_admission_granted,false);
assert.equal(complete.g2_policy_modified,false);
assert.equal(complete.fact_confirmation_authorized,false);
assert.equal(complete.database_writes,0);
for(const [key] of CHECKS){
 const evidence={...full,[key]:false};
 const result=review({evidence});
 assert.equal(result.decision,"LIMITED_RELEASE_HOLD");
 assert.equal(result.checks_reported_complete,11);
}
assert.throws(()=>review({evidence:{review_source_rights_approved:"yes"}}),TypeError);
assert.throws(()=>review({evidence:{},scope:"ALL_PRODUCTS"}),TypeError);
console.log("Cleanser limited-fit release firewall: PASS (12 independent checks; no mandated manufacturer reply, zero grants/writes)");
