import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePath = path.join(root, "evidence/crawler-controlled-operational-activation-v1.json");
const manifestPath = path.join(root, "crawler/config/controlled-operational-activation-v1.json");
const loaderPath = path.join(root, "crawler/image-source-policy-loader.mjs");

const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const jobs = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(evidence.stageVersion === "crawler-controlled-operational-activation-v1", "stage_version_mismatch");
assert(evidence.status === "STRICT_SUCCESS_CLOSED", "stage_not_closed");
assert(
  evidence.primaryOutcome === "CONTROLLED_CRAWLER_OPERATION_VALIDATED__NO_SAFE_CANONICAL_ADOPTION_CANDIDATE",
  "primary_outcome_mismatch",
);

assert(Array.isArray(jobs) && jobs.length === 1, "controlled_job_count_must_equal_one");
const [job] = jobs;
assert(job.id === "hwahae-skincare-toner-category-all", "controlled_job_id_mismatch");
assert(job.enabled === true, "controlled_job_must_be_enabled");
assert(job.limit === 10 && job.requested_limit === 10, "controlled_job_rank_ceiling_mismatch");
assert(job.service_category === "toner_essence", "controlled_job_service_category_mismatch");
assert(job.themeId === 5106, "controlled_job_theme_mismatch");

const manifest = evidence.manifest;
assert(manifest.rankCeiling === 10, "rank_ceiling_mismatch");
assert(manifest.crawlExecutions === 1, "crawl_execution_ceiling_mismatch");
assert(manifest.observationWriteCeiling === 10, "observation_ceiling_mismatch");
assert(manifest.candidateWriteCeiling === 10, "candidate_ceiling_mismatch");
assert(manifest.reviewCeiling === 5, "review_ceiling_mismatch");
assert(manifest.canonicalPromotionCeiling === 1, "promotion_ceiling_mismatch");
assert(manifest.scheduler === "OFF" && manifest.autoAdoption === "OFF", "activation_boundary_not_off");
assert(!manifest.invocation.includes("--all"), "broad_crawl_invocation_forbidden");

const run = evidence.results.sourceRun;
assert(run.realSourceRequest === true, "real_source_request_missing");
assert(run.jobsCrawled === 1 && run.jobsSucceeded === 1 && run.jobsFailed === 0, "source_run_job_result_mismatch");
assert(run.rowsObserved === 10, "source_run_row_count_mismatch");
assert(run.snapshotsWritten === 1, "snapshot_write_count_mismatch");
assert(run.sourceRankingsWritten === 10, "source_ranking_write_count_mismatch");
assert(run.newCandidates === 4 && run.reobservedCandidates === 6, "candidate_intake_count_mismatch");
assert(run.productsWritten === 0 && run.errors === 0, "source_run_safety_mismatch");

const review = evidence.results.review;
assert(review.ruleVersion === "ranking-review-v2", "review_rule_version_mismatch");
assert(review.runTouchedReviewEligible === 0, "unexpected_run_touched_review_eligibility");
assert(review.selectedForManualReview === 0, "unexpected_manual_review_selection");
assert(review.refresh.productsWritten === 0, "review_refresh_wrote_products");

const identity = evidence.results.identity;
assert(identity.reviewed === 0 && identity.resolved === 0, "identity_review_should_not_run_without_queue_eligibility");
assert(identity.runTouchedUnresolved === 10, "run_touched_identity_state_mismatch");

const promotion = evidence.results.promotion;
assert(promotion.attempted === false && promotion.count === 0, "unexpected_structural_promotion");
assert(evidence.postRun.products === 164, "product_count_changed");
assert(evidence.postRun.structuralAdoptionRequests === 0, "unexpected_structural_adoption_request");
assert(evidence.postRun.legacy === 164 && evidence.postRun.nonLegacy === 0, "legacy_topology_changed");
assert(
  evidence.postRun.legacyUuidSha256 === "b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05",
  "legacy_uuid_hash_changed",
);

const deltas = evidence.deltas;
assert(deltas.rankingSnapshots === 1, "ranking_snapshot_delta_mismatch");
assert(deltas.sourceRankings === 10, "source_ranking_delta_mismatch");
assert(deltas.productCandidates === 4, "candidate_delta_mismatch");
assert(deltas.promotionReviewRowCount === 0, "promotion_review_row_delta_mismatch");
assert(deltas.products === 0, "product_delta_mismatch");
assert(deltas.productFactAuthority === 0, "product_fact_authority_delta_mismatch");
assert(deltas.recommendationSemanticAuthority === 0, "recommendation_semantic_authority_delta_mismatch");
assert(deltas.unauthorized === 0, "unauthorized_delta_detected");

assert(evidence.results.g3.newProductProbe === "NOT_APPLICABLE_NO_STRUCTURAL_PROMOTION", "g3_probe_state_mismatch");
assert(evidence.finalActivation.manualCrawler === "CONTROLLED_RESUMPTION_VALIDATED", "manual_crawler_not_validated");
assert(evidence.finalActivation.scheduledCrawler === "OFF", "scheduled_crawler_enabled");
assert(evidence.finalActivation.cron === "OFF", "cron_enabled");
assert(evidence.finalActivation.autoAdoption === "OFF", "auto_adoption_enabled");
assert(evidence.finalActivation.bulkPromotion === "OFF", "bulk_promotion_enabled");
assert(fs.existsSync(loaderPath), "crawler_runtime_loader_missing");

console.log("crawler-controlled-operational-activation-v1 evidence verifier: PASS");
