/**
 * Shared R5 read-only proof for original Skin Match total + component
 * reconciliation. This is a validator, NOT a scoring algorithm.
 */
export const CLEANSER_R5_SCORE_RECONCILIATION_VERSION =
  "cleanser-r5-original-engine-score-reconciliation-v1";
const COMPONENTS=Object.freeze([
  "baseScore","environmentAdjustment","heroBoost","reviewSignalScore",
  "ingredientSignalScore","marketConfidenceScore","hardPenalty"
]);
export function verifyCleanserEngineComponentSumV1(row){
  const b=row?.score_breakdown;
  if(!b||!Number.isFinite(row?.engine_score)||
    !Number.isFinite(b.engineScore)||!Number.isFinite(b.engine_score)||
    COMPONENTS.some(k=>!Number.isFinite(b[k]))||
    b.engine_score!==row.engine_score||b.engineScore!==row.engine_score)
    throw new TypeError("SKIN_MATCH_ENGINE_COMPONENTS_INVALID");
  const sum=COMPONENTS.reduce((acc,key)=>acc+b[key],0);
  // Skin Match uses tenth-place rounding for its final score. Rounding can
  // introduce <=0.05 difference from the unrounded sum.
  if(Math.abs(sum-row.engine_score)>0.0500000001)
    throw new Error("SKIN_MATCH_ENGINE_SCORE_SUM_MISMATCH");
  return Object.freeze({
    version:CLEANSER_R5_SCORE_RECONCILIATION_VERSION,
    matched:true,actual_engine_score:row.engine_score,
    component_count:COMPONENTS.length
  });
}
export function verifyCleanserReviewAxisParityV1(row,expected){
  verifyCleanserEngineComponentSumV1(row);
  if(!Number.isFinite(expected)||Math.abs(expected)>10||
    row.score_breakdown.reviewSignalScore!==expected||
    row.score_breakdown.review_signal_score!==expected)
    throw new Error("CANONICAL_REVIEW_AXIS_NOT_REUSED_EXACTLY_ONCE");
  return true;
}
