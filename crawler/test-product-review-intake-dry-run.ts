import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  parseReviewedImportArgs,
  ReviewCliArgumentError,
} from "./lib/reviews/review-cli-args.js";
import { writeReviewExportBatch } from "./lib/reviews/review-file-boundary.js";
import {
  REVIEWED_HEADERS,
  type IntakeDatabaseSnapshot,
  type ReviewedCsvRow,
} from "./lib/reviews/review-export-contract.js";
import { serializeCsv } from "./lib/reviews/review-csv.js";
import { runReviewedIntakeDryRun } from "./lib/reviews/reviewed-intake-dry-run.js";
import {
  IntakeFileError,
  loadParsedReviewedBatch,
} from "./lib/reviews/reviewed-intake-parser.js";
import {
  FIXTURE_CANDIDATE_IDS,
  createIntakeFixture,
} from "./tests/fixtures/product-review-export-intake.js";

function cloneRows(rows: ReviewedCsvRow[]): ReviewedCsvRow[] {
  return rows.map((row) => Object.assign(Object.create(null), row));
}

function cloneSnapshot(snapshot: IntakeDatabaseSnapshot): IntakeDatabaseSnapshot {
  return {
    candidates: new Map(
      [...snapshot.candidates].map(([key, value]) => [key, { ...value }]),
    ),
    reviews: new Map(
      [...snapshot.reviews].map(([key, value]) => [key, { ...value }]),
    ),
    products: new Map(
      [...snapshot.products].map(([key, value]) => [key, { ...value }]),
    ),
  };
}

async function main(): Promise<void> {
  const fixture = createIntakeFixture();
  const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "bejewely-review-intake-"),
  );

  try {
    const batchDirectory = await writeReviewExportBatch(
      temporaryRoot,
      "batch",
      fixture.batch,
      false,
    );
    const reviewedFile = path.join(batchDirectory, "reviewed.csv");

    async function parseRows(rows: ReviewedCsvRow[]) {
      await fs.writeFile(
        reviewedFile,
        serializeCsv(REVIEWED_HEADERS, rows),
        "utf8",
      );
      return loadParsedReviewedBatch(reviewedFile);
    }

    async function runRows(
      rows: ReviewedCsvRow[],
      snapshot = fixture.snapshot,
    ) {
      const parsed = await parseRows(rows);
      const beforeCounts = {
        products: snapshot.products.size,
        candidates: snapshot.candidates.size,
        reviews: snapshot.reviews.size,
        audits: 0,
        confirmations: 0,
      };
      const result = await runReviewedIntakeDryRun(parsed, async () => snapshot);
      const afterCounts = {
        products: snapshot.products.size,
        candidates: snapshot.candidates.size,
        reviews: snapshot.reviews.size,
        audits: 0,
        confirmations: 0,
      };
      assert.deepEqual(afterCounts, beforeCounts);
      assert.equal(result.summary.products_writes, 0);
      assert.equal(result.summary.database_writes, 0);
      return result;
    }

    const baseline = await runRows(cloneRows(fixture.reviewedRows));
    assert.equal(baseline.summary.status, "PASS");
    assert.equal(baseline.summary.valid_rows, 5);
    assert.equal(baseline.summary.approve_create_new, 1);
    assert.equal(baseline.summary.approve_merge_existing, 1);
    assert.equal(baseline.summary.defer, 2);
    assert.equal(baseline.summary.block, 1);

    const staleSnapshot = cloneSnapshot(fixture.snapshot);
    staleSnapshot.candidates.get(FIXTURE_CANDIDATE_IDS[4])!.updated_at =
      "2026-07-30T00:00:00.000Z";
    const stale = await runRows(cloneRows(fixture.reviewedRows), staleSnapshot);
    assert.equal(stale.summary.status, "FAIL");
    assert.ok(
      stale.errors.some(
        (error) => error.error_code === "reviewed_row_stale_candidate",
      ),
    );

    const staleReviewSnapshot = cloneSnapshot(fixture.snapshot);
    staleReviewSnapshot.reviews.get(FIXTURE_CANDIDATE_IDS[4])!.updated_at =
      "2026-07-30T00:00:00.000Z";
    const staleReview = await runRows(
      cloneRows(fixture.reviewedRows),
      staleReviewSnapshot,
    );
    assert.ok(
      staleReview.errors.some(
        (error) => error.error_code === "reviewed_row_stale_review_queue",
      ),
    );

    const staleEvidenceSnapshot = cloneSnapshot(fixture.snapshot);
    staleEvidenceSnapshot.reviews.get(FIXTURE_CANDIDATE_IDS[4])!.evidence_snapshot = {
      changed: true,
    };
    const staleEvidence = await runRows(
      cloneRows(fixture.reviewedRows),
      staleEvidenceSnapshot,
    );
    assert.ok(
      staleEvidence.errors.some(
        (error) => error.error_code === "reviewed_row_stale_evidence",
      ),
    );

    const tamperedHashRows = cloneRows(fixture.reviewedRows);
    tamperedHashRows[0].row_integrity_hash = "0".repeat(64);
    const tamperedHash = await runRows(tamperedHashRows);
    assert.ok(
      tamperedHash.errors.some(
        (error) => error.error_code === "reviewed_row_integrity_mismatch",
      ),
    );

    const invalidEnumRows = cloneRows(fixture.reviewedRows);
    invalidEnumRows[0].texture = "silky";
    const invalidEnum = await runRows(invalidEnumRows);
    assert.ok(
      invalidEnum.errors.some(
        (error) => error.error_code === "reviewed_texture_invalid",
      ),
    );

    const treatmentRows = cloneRows(fixture.reviewedRows);
    treatmentRows[0].product_form = "";
    const missingProductForm = await runRows(treatmentRows);
    assert.ok(
      missingProductForm.errors.some(
        (error) => error.error_code === "reviewed_product_form_required",
      ),
    );

    const sensitivityRows = cloneRows(fixture.reviewedRows);
    sensitivityRows[0].sensitivity_safe = "maybe";
    const sensitivity = await runRows(sensitivityRows);
    assert.ok(
      sensitivity.errors.some(
        (error) => error.error_code === "reviewed_sensitivity_safe_invalid",
      ),
    );

    const unsafeSourceRows = cloneRows(fixture.reviewedRows);
    unsafeSourceRows[0].review_source_urls_json = '["javascript:alert(1)"]';
    const unsafeSource = await runRows(unsafeSourceRows);
    assert.ok(
      unsafeSource.errors.some(
        (error) => error.error_code === "reviewed_source_url_unsafe",
      ),
    );

    const identityRows = cloneRows(fixture.reviewedRows);
    identityRows[1].canonical_name = "Different Cream";
    const identityConflict = await runRows(identityRows);
    assert.ok(
      identityConflict.errors.some(
        (error) =>
          error.error_code === "reviewed_existing_product_identity_conflict",
      ),
    );

    const exportedMatchConflictRows = cloneRows(fixture.reviewedRows);
    exportedMatchConflictRows[0].existing_product_match_id_reviewed =
      fixture.reviewedRows[1].existing_product_match_id_reviewed;
    exportedMatchConflictRows[0].duplicate_check_status = "checked_match";
    const exportedMatchConflict = await runRows(exportedMatchConflictRows);
    assert.ok(
      exportedMatchConflict.errors.some(
        (error) =>
          error.error_code === "reviewed_existing_product_match_conflict",
      ),
    );

    const duplicateCreateRows = cloneRows(fixture.reviewedRows);
    const duplicateTarget = duplicateCreateRows[4];
    const sourceApprove = duplicateCreateRows[0];
    Object.assign(duplicateTarget, {
      review_decision: "approve",
      canonical_brand: sourceApprove.canonical_brand,
      canonical_name: sourceApprove.canonical_name,
      canonical_category: sourceApprove.canonical_category,
      product_form: sourceApprove.product_form,
      skin_types_json: sourceApprove.skin_types_json,
      concerns_json: sourceApprove.concerns_json,
      texture: sourceApprove.texture,
      finish: sourceApprove.finish,
      irritation_risk: sourceApprove.irritation_risk,
      sensitivity_safe: sourceApprove.sensitivity_safe,
      official_product_page_status: sourceApprove.official_product_page_status,
      ingredient_list_status: sourceApprove.ingredient_list_status,
      duplicate_check_status: sourceApprove.duplicate_check_status,
      field_evidence_json: sourceApprove.field_evidence_json.replaceAll(
        FIXTURE_CANDIDATE_IDS[0],
        FIXTURE_CANDIDATE_IDS[4],
      ),
      field_confidence_json: sourceApprove.field_confidence_json,
      defer_reason: "",
    });
    const duplicateCreate = await runRows(duplicateCreateRows);
    assert.ok(
      duplicateCreate.errors.some(
        (error) =>
          error.error_code === "reviewed_batch_duplicate_product_create",
      ),
    );

    const malformedJsonRows = cloneRows(fixture.reviewedRows);
    malformedJsonRows[0].skin_types_json = '["oily"';
    const malformedJson = await runRows(malformedJsonRows);
    assert.ok(
      malformedJson.errors.some(
        (error) => error.error_code === "reviewed_json_cell_invalid",
      ),
    );

    const oversizedJsonRows = cloneRows(fixture.reviewedRows);
    oversizedJsonRows[0].review_source_urls_json = JSON.stringify([
      `https://example.com/${"a".repeat(40_000)}`,
    ]);
    const oversizedJson = await runRows(oversizedJsonRows);
    assert.ok(
      oversizedJson.errors.some(
        (error) => error.error_code === "reviewed_json_cell_too_large",
      ),
    );

    const formulaRows = cloneRows(fixture.reviewedRows);
    formulaRows[0].canonical_brand = "=HYPERLINK(\"https://example.com\")";
    const formula = await runRows(formulaRows);
    assert.ok(
      formula.errors.some(
        (error) => error.error_code === "reviewed_formula_injection",
      ),
    );

    const batchIdRows = cloneRows(fixture.reviewedRows);
    batchIdRows[0].export_batch_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await assert.rejects(
      () => parseRows(batchIdRows),
      (error: unknown) =>
        error instanceof IntakeFileError &&
        error.code === "reviewed_row_contract_invalid",
    );

    const duplicateRows = cloneRows(fixture.reviewedRows);
    duplicateRows[4].candidate_id = duplicateRows[0].candidate_id;
    await assert.rejects(
      () => parseRows(duplicateRows),
      (error: unknown) =>
        error instanceof IntakeFileError &&
        error.code === "reviewed_duplicate_candidate_id",
    );

    const originalManifest = await fs.readFile(
      path.join(batchDirectory, "manifest.csv"),
      "utf8",
    );
    await fs.writeFile(
      path.join(batchDirectory, "manifest.csv"),
      `${originalManifest}tamper`,
      "utf8",
    );
    await assert.rejects(
      () => parseRows(cloneRows(fixture.reviewedRows)),
      (error: unknown) =>
        error instanceof IntakeFileError &&
        error.code === "review_manifest_hash_mismatch",
    );
    await fs.writeFile(
      path.join(batchDirectory, "manifest.csv"),
      originalManifest,
      "utf8",
    );

    assert.throws(
      () =>
        parseReviewedImportArgs([
          "--file",
          "data/reviewed.csv",
          "--confirm",
        ]),
      (error: unknown) =>
        error instanceof ReviewCliArgumentError &&
        error.code === "review_import_actor_user_id_invalid",
    );

    assert.deepEqual(
      parseReviewedImportArgs([
        "--file",
        "data/reviewed.csv",
        "--confirm",
        "--actor-user-id",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "--request-id",
        "review-import-test-001",
      ]),
      {
        file: "data/reviewed.csv",
        mode: "confirm",
        actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        requestId: "review-import-test-001",
      },
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }

  process.stdout.write(
    "verify:product-review-intake-dry-run PASS (parser, snapshots, decisions, identity, stale, negative fixtures, zero-write, confirm argument boundary)\n",
  );
}

main().catch((error) => {
  process.stderr.write("verify:product-review-intake-dry-run FAIL\n");
  if (error instanceof Error) process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
