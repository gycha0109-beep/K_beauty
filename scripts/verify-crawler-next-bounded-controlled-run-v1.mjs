import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePath = path.join(root, "evidence/crawler-next-bounded-controlled-run-v1.json");
const manifestPath = path.join(root, "crawler/config/next-bounded-controlled-run-v1.json");
const corpusPath = path.join(root, "fixtures/recommendation-governance/legacy-frozen-recommendation-corpus-v1.txt");
const docPath = path.join(root, "docs/evidence/crawler-next-bounded-controlled-run-v1.md");
const runWorkflowPath = path.join(root, ".github/workflows/crawler-next-bounded-controlled-run-v1.yml");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const jobs = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const corpusText = fs.readFileSync(corpusPath, "utf8");
const corpusHash = crypto.createHash("sha256").update(corpusText, "utf8").digest("hex");
const corpusIds = corpusText.endsWith("\n") ? corpusText.slice(0, -1).split("\n") : [];

assert(evidence.stageVersion === "crawler-next-bounded-controlled-run-v1", "stage_version_mismatch");
assert(evidence.status === "REPOSITORY_CLOSEOUT_CANDIDATE", "closeout_candidate_status_required");
assert(evidence.startingMainSha === "a9d3883d130a29facaa58c665ec7fe7bdafd7b70", "starting_main_sha_mismatch");
assert(evidence.startingProductionSha === evidence.startingMainSha, "starting_production_sha_mismatch");
assert(evidence.productionReady === true, "starting_production_not_ready");
assert(evidence.kstDate === "2026-08-22", "kst_date_mismatch");
assert(evidence.source === "hwahae", "source_mismatch");
assert(evidence.jobId === "hwahae-essence-ampoule-serum-trouble", "job_id_mismatch");
assert(evidence.serviceCategory === "treatment", "service_category_mismatch");
assert(evidence.reviewRuleVersion === "ranking-review-v2", "review_rule_version_mismatch");

assert(Array.isArray(jobs) && jobs.length === 1, "bounded_job_count_must_equal_one");
const [job] = jobs;
assert(job.id === evidence.jobId, "manifest_job_id_mismatch");
assert(job.source === "hwahae", "manifest_source_mismatch");
assert(job.source_category_key === "essence_ampoule_serum", "manifest_source_category_mismatch");
assert(job.service_category === "treatment", "manifest_service_category_mismatch");
assert(job.ranking_scope === "concern", "manifest_ranking_scope_mismatch");
assert(job.ranking_filter === "trouble", "manifest_ranking_filter_mismatch");
assert(job.source_concern_key === "trouble", "manifest_concern_key_mismatch");
assert(JSON.stringify(job.canonical_concerns) === JSON.stringify(["acne"]), "manifest_canonical_concern_mismatch");
assert(job.themeId === 4181, "manifest_theme_id_mismatch");
assert(job.limit === 10 && job.requested_limit === 10, "manifest_rank_ceiling_mismatch");
assert(job.enabled === true, "bounded_job_not_enabled");

const ceilings = evidence.ceilings;
assert(ceilings.sourceJobs === 1, "source_job_ceiling_mismatch");
assert(ceilings.realCrawlExecutions === 1, "crawl_execution_ceiling_mismatch");
assert(ceilings.observedRows === 10, "observed_row_ceiling_mismatch");
assert(ceilings.newOrUpdatedCandidates === 10, "candidate_ceiling_mismatch");
assert(ceilings.reviewCandidatesExamined === 5, "review_ceiling_mismatch");
assert(ceilings.identityResolutions === 5, "identity_ceiling_mismatch");
assert(ceilings.canonicalPromotions === 1, "promotion_ceiling_mismatch");
assert(evidence.ratePolicy.delayMs === 1500, "rate_delay_mismatch");
assert(evidence.ratePolicy.retries === 2, "retry_ceiling_mismatch");
assert(evidence.ratePolicy.unboundedRetry === false, "unbounded_retry_forbidden");

assert(evidence.preflightAttempts.failedBeforeExternalRequest === 2, "preflight_failure_count_mismatch");
assert(evidence.preflightAttempts.hostedDeltaFromFailedPreflights === 0, "failed_preflight_hosted_delta_detected");

const pre = evidence.preRunHosted;
assert(pre.rankingSnapshots === 28, "pre_ranking_snapshot_count_mismatch");
assert(pre.sourceRankings === 790, "pre_source_ranking_count_mismatch");
assert(pre.productCandidates === 168, "pre_candidate_count_mismatch");
assert(pre.promotionReviews === 50, "pre_review_count_mismatch");
assert(pre.structuralAdoptionRequests === 0, "pre_structural_request_count_mismatch");
assert(pre.products === 164 && pre.legacy === 164 && pre.nonLegacy === 0, "pre_legacy_topology_mismatch");
assert(pre.registryVersions === 1, "pre_registry_version_count_mismatch");
assert(pre.definitionSnapshots === 20, "pre_definition_snapshot_count_mismatch");
assert(pre.subjects === 16, "pre_subject_count_mismatch");
assert(pre.factInstances === 41, "pre_fact_instance_count_mismatch");
assert(pre.evidenceLinks === 41, "pre_evidence_link_count_mismatch");
assert(pre.reviewAssignments === 41, "pre_review_assignment_count_mismatch");
assert(pre.reviewEvents === 180, "pre_review_event_count_mismatch");
assert(pre.confirmations === 41, "pre_confirmation_count_mismatch");
assert(pre.currentFacts === 41, "pre_current_fact_count_mismatch");
assert(pre.reviewQueue.queued === 30 && pre.reviewQueue.deferred === 20, "pre_review_queue_mismatch");
assert(pre.reviewQueue.ruleVersion === "ranking-review-v2", "pre_review_rule_version_mismatch");

const run = evidence.realRun;
assert(run.successfulRunHead === "879c63b54d193ee9e277de74a664eb03f7752d85", "successful_run_head_mismatch");
assert(run.actionsRunId === 32564016568, "actions_run_id_mismatch");
assert(run.actionsJobId === 97009847037, "actions_job_id_mismatch");
assert(run.realExternalRequest === true, "real_external_request_missing");
assert(run.sourceFailures === 0, "source_failure_detected");
assert(run.jobsCrawled === 1, "real_job_count_mismatch");
assert(run.observedRows === 10, "real_observed_row_count_mismatch");
assert(run.snapshotsWritten === 1, "snapshot_write_count_mismatch");
assert(run.sourceRankingsWritten === 10, "source_ranking_write_count_mismatch");
assert(run.newCandidates === 8 && run.reobservedCandidates === 2, "candidate_intake_count_mismatch");
assert(run.productsWritten === 0, "crawler_wrote_products");
assert(run.snapshotId === "a12d6543-b5fe-46d0-96d5-2cb8b5c121d5", "snapshot_id_mismatch");
assert(run.snapshotHash === "71a0e9e75046d28ba0fd9e71a9db60a373413ded806bc44fa9f412184e7aaab4", "snapshot_hash_mismatch");

const refresh = evidence.reviewRefresh;
assert(refresh.executions === 1, "review_refresh_execution_count_mismatch");
assert(refresh.ruleVersion === "ranking-review-v2", "refresh_rule_version_mismatch");
assert(refresh.candidatesExamined === 38, "refresh_examined_count_mismatch");
assert(refresh.reviewsInserted === 8, "refresh_insert_count_mismatch");
assert(refresh.reviewsUpdated === 30, "refresh_update_count_mismatch");
assert(refresh.reviewsDeferred === 0, "refresh_deferred_count_mismatch");
assert(refresh.protectedReviewsSkipped === 0, "refresh_protected_skip_count_mismatch");
assert(refresh.productsWritten === 0, "review_refresh_wrote_products");

const progression = evidence.reviewProgression;
assert(progression.runTouchedCandidates === 10, "run_touched_candidate_count_mismatch");
assert(progression.distinctDateProgressions === 2, "distinct_date_progression_count_mismatch");
assert(progression.newlyReviewEligible === 8, "new_review_eligibility_count_mismatch");
assert(progression.newlyReviewEligibleReason === "top_15_immediate", "new_review_eligibility_reason_mismatch");
assert(progression.existingReviewEligibleUnchanged === 2, "existing_review_eligibility_count_mismatch");
assert(progression.sameDayPersistenceInflation === 0, "same_day_persistence_inflation_detected");
assert(progression.ruleVersionConsistency === true, "review_rule_version_inconsistent");
assert(Array.isArray(progression.thirdDateCandidates) && progression.thirdDateCandidates.length === 2, "third_date_candidate_count_mismatch");
for (const candidate of progression.thirdDateCandidates) {
  assert(JSON.stringify(candidate.kstDates) === JSON.stringify(["2026-06-22", "2026-06-23", "2026-08-22"]), "third_date_evidence_mismatch");
}

const identity = evidence.identityReview;
assert(identity.reviewed === 5, "identity_review_count_mismatch");
assert(identity.resolved === 0, "unexpected_identity_resolution");
assert(identity.identityAmbiguous === 2, "identity_ambiguity_count_mismatch");
assert(identity.variantScopeConflict === 3, "variant_scope_conflict_count_mismatch");
assert(identity.formulationScopeConflict === 0, "formulation_scope_conflict_count_mismatch");
assert(identity.reformulationCandidate === 0, "reformulation_candidate_count_mismatch");
assert(identity.blocked === 5, "identity_blocked_count_mismatch");
assert(identity.remainingRunTouchedUnresolved === 5, "remaining_unresolved_count_mismatch");
assert(identity.selectedForPromotion === 0, "unexpected_promotion_selection");
assert(identity.contractVersion === "crawler-identity-resolution-v1", "identity_contract_version_mismatch");
assert(identity.auditEventsRecorded === 5, "identity_audit_event_count_mismatch");

const promotion = evidence.promotion;
assert(promotion.preflightEntered === false, "promotion_preflight_should_not_run");
assert(promotion.attempted === 0 && promotion.succeeded === 0, "unexpected_structural_promotion");
assert(promotion.newCanonicalUuid === null, "unexpected_new_canonical_uuid");
assert(promotion.reason === "no_safe_resolved_novel_candidate", "promotion_reason_mismatch");
assert(promotion.semanticAuthorityWritten === false, "semantic_authority_write_detected");
assert(promotion.structuralAdoptionRequests === 0, "structural_adoption_request_detected");

const g3 = evidence.g3Proof;
assert(g3.newProductRuntimeProbeApplicable === false, "unexpected_new_product_g3_probe");
assert(g3.recommendationAuthoritySeparation === "PRESERVED", "recommendation_authority_separation_regressed");
assert(g3.pfAuthorityDelta === 0, "pf_authority_delta_detected");
assert(g3.newNonLegacyProducts === 0, "new_nonlegacy_product_detected");

const post = evidence.postRunHosted;
assert(post.rankingSnapshots === 29, "post_ranking_snapshot_count_mismatch");
assert(post.sourceRankings === 800, "post_source_ranking_count_mismatch");
assert(post.productCandidates === 176, "post_candidate_count_mismatch");
assert(post.promotionReviews === 58, "post_review_count_mismatch");
assert(post.structuralAdoptionRequests === 0, "post_structural_request_count_mismatch");
assert(post.products === 164 && post.legacy === 164 && post.nonLegacy === 0, "post_legacy_topology_mismatch");
assert(post.registryVersions === 1, "post_registry_version_count_mismatch");
assert(post.definitionSnapshots === 20, "post_definition_snapshot_count_mismatch");
assert(post.subjects === 16, "post_subject_count_mismatch");
assert(post.factInstances === 41, "post_fact_instance_count_mismatch");
assert(post.evidenceLinks === 41, "post_evidence_link_count_mismatch");
assert(post.reviewAssignments === 41, "post_review_assignment_count_mismatch");
assert(post.reviewEvents === 180, "post_review_event_count_mismatch");
assert(post.confirmations === 41, "post_confirmation_count_mismatch");
assert(post.currentFacts === 41, "post_current_fact_count_mismatch");
assert(post.reviewQueue.queued === 38 && post.reviewQueue.deferred === 20, "post_review_queue_mismatch");
assert(post.reviewQueue.ruleVersion === "ranking-review-v2", "post_review_rule_version_mismatch");

const delta = evidence.deltaLedger;
assert(delta.rankingSnapshots === 1, "ranking_snapshot_delta_mismatch");
assert(delta.sourceRankings === 10, "source_ranking_delta_mismatch");
assert(delta.productCandidates === 8, "candidate_delta_mismatch");
assert(delta.promotionReviews === 8, "review_delta_mismatch");
assert(delta.identityAuditEvents === 5, "identity_audit_delta_mismatch");
assert(delta.structuralAdoptionRequests === 0, "structural_request_delta_mismatch");
assert(delta.products === 0, "product_delta_mismatch");
assert(delta.factInstances === 0 && delta.confirmations === 0 && delta.currentFacts === 0, "product_fact_authority_delta_detected");
assert(delta.unauthorizedDelta === 0, "unauthorized_delta_detected");

assert(corpusText.endsWith("\n"), "legacy_corpus_final_lf_required");
assert(corpusIds.length === 164, "legacy_corpus_count_mismatch");
assert(new Set(corpusIds).size === 164, "legacy_corpus_duplicate_id");
assert(corpusHash === "b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05", "legacy_corpus_hash_mismatch");
assert(evidence.legacyExpected.version === "LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1", "legacy_version_mismatch");
assert(evidence.legacyExpected.count === corpusIds.length, "legacy_expected_count_mismatch");
assert(evidence.legacyExpected.sha256 === corpusHash, "legacy_expected_hash_mismatch");

const automation = evidence.finalAutomationState;
assert(automation.manualControlledCrawler === "VALIDATED", "manual_crawler_not_validated");
assert(automation.scheduler === "OFF", "scheduler_enabled");
assert(automation.cron === "OFF", "cron_enabled");
assert(automation.autoAdoption === "OFF", "auto_adoption_enabled");
assert(automation.bulkPromotion === "OFF", "bulk_promotion_enabled");
assert(automation.unboundedCrawler === "NOT_AUTHORIZED", "unbounded_crawler_authorized");

const closeout = evidence.repositoryCloseout;
assert(closeout.realCrawlerMustNotRerun === true, "closeout_crawler_rerun_not_forbidden");
assert(closeout.reviewRefreshMustNotRerun === true, "closeout_refresh_rerun_not_forbidden");
assert(closeout.closeoutUsesReadOnlyHostedVerification === true, "closeout_not_read_only");
assert(closeout.requiresExactLegacySetEquality === true, "legacy_set_equality_not_required");
assert(closeout.requiresMergedMainExactShaCi === true, "merged_main_ci_not_required");
assert(closeout.requiresProductionExactMergeShaReady === true, "production_exact_sha_not_required");

const finalOutcome = evidence.finalOutcome;
assert(finalOutcome.stage === "STRICT_SUCCESS_PENDING_MERGED_MAIN_CLOSEOUT", "final_stage_mismatch");
assert(finalOutcome.primaryOutcome === "BOUNDED_CRAWLER_RUN_VALIDATED__NO_SAFE_CANONICAL_ADOPTION_CANDIDATE", "primary_outcome_mismatch");
assert(finalOutcome.reviewEligibilityProgression === "VALIDATED", "review_progression_not_validated");
assert(finalOutcome.canonicalAdoption === 0, "unexpected_canonical_adoption");
assert(finalOutcome.recommendationAuthoritySeparation === "PRESERVED", "final_recommendation_authority_separation_mismatch");

assert(fs.existsSync(docPath), "evidence_document_missing");
assert(fs.existsSync(runWorkflowPath), "bounded_run_workflow_missing");

console.log("crawler-next-bounded-controlled-run-v1 closeout evidence verifier: PASS");
