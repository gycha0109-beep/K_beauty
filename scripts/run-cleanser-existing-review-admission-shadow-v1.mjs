#!/usr/bin/env node
/** Local, offline, sanitized R3/R4 review-contribution assessment only. */
import {readFile} from "node:fs/promises";
import {
 evaluateCleanserReviewAdmissionShadowV1 as evaluate
} from "../lib/trust/cleanser-existing-review-admission-shadow-v1.mjs";
if(process.argv.length!==2)throw new Error("NO_RUNTIME_FLAGS_OR_G2_AUTHORITY");
const load=async path=>JSON.parse(await readFile(path,"utf8"));
const [replay,footprint]=await Promise.all([
 load("evidence/trust/cleanser-actual-review-score-replay-20261024-v1.json"),
 load("evidence/trust/cleanser-existing-hwahae-signal-footprint-20261024-v1.json")
]);
const decisions=evaluate({
 actualReplay:replay,cohortFootprint:footprint,
 expectedIds:footprint.records.map(x=>x.product_id)
});
const labels=Object.freeze({
 POSITIVE_REVIEW_CONTRIBUTION_ONLY:"긍정적인 리뷰 보정점(추천 승인은 아님)",
 NEGATIVE_REVIEW_CAUTION_ONLY:"부정적인 리뷰 보정점",
 NO_REVIEW_SCORE_CONTRIBUTION:"이 피부 조건에서 리뷰 보정점 없음",
 UNMAPPED_REVIEW_HOLD:"리뷰 태그 매핑 부족",
 NO_CAPTURE_HOLD:"화해 리뷰 캡처 없음"
});
process.stdout.write(JSON.stringify({
 version:decisions.version,
 summary:{
  existing_products:decisions.product_count,
  skin_contexts:decisions.profile_count,
  review_signal_input_candidates:decisions.candidate_review_signal_inputs,
  breakdown:decisions.context_classification_totals,
  actual_new_recommendation_admissions:decisions.production_admissions,
  g2_grants:decisions.g2_grants,
  score_changes:decisions.score_modifications,
  production_writes:decisions.database_writes
 },
 product_reviews:decisions.decisions.map(row=>({
  product_id:row.product_id,
  name:row.product_name,
  by_context:row.contexts.map(x=>({
    context:x.profile,
    review_score_only:x.observed_canonical_review_score,
    interpretation:labels[x.status],
    added_as_new_score:false,
    actually_recommended:false
  }))
 }))
},null,2)+"\n");
