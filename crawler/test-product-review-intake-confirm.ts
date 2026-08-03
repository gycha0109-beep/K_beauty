import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { writeReviewExportBatch } from "./lib/reviews/review-file-boundary.js";
import {
  REVIEWED_HEADERS,
  type ReviewImportConfirmResult,
} from "./lib/reviews/review-export-contract.js";
import { serializeCsv } from "./lib/reviews/review-csv.js";
import {
  normalizePromotionBrand,
  normalizePromotionProduct,
} from "./lib/reviews/review-promotion-identity.js";
import { runReviewedIntakeDryRun } from "./lib/reviews/reviewed-intake-dry-run.js";
import {
  buildReviewImportConfirmPayload,
  confirmReviewedImportBatch,
  formatConfirmResult,
  lookupReviewedImportConfirmation,
  ReviewImportConfirmError,
} from "./lib/reviews/reviewed-intake-confirm.js";
import { loadParsedReviewedBatch } from "./lib/reviews/reviewed-intake-parser.js";
import { createIntakeFixture } from "./tests/fixtures/product-review-export-intake.js";

async function main(): Promise<void> {
  assert.equal(normalizePromotionBrand("LaRoche-Posay"), "la roche posay");
  assert.equal(normalizePromotionBrand("MakeP:Rem"), "makep rem");
  assert.equal(
    normalizePromotionProduct("Calm Serum 30ml Limited Edition"),
    "calm serum",
  );

  const fixture = createIntakeFixture();
  const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "bejewely-review-confirm-"),
  );

  try {
    const batchDirectory = await writeReviewExportBatch(
      temporaryRoot,
      "batch",
      fixture.batch,
      false,
    );
    const reviewedFile = path.join(batchDirectory, "reviewed.csv");
    await fs.writeFile(
      reviewedFile,
      serializeCsv(REVIEWED_HEADERS, fixture.reviewedRows),
      "utf8",
    );

    const parsed = await loadParsedReviewedBatch(reviewedFile);
    const dryRun = await runReviewedIntakeDryRun(parsed, async () => fixture.snapshot);
    assert.equal(dryRun.summary.status, "PASS");

    const first = buildReviewImportConfirmPayload(parsed, dryRun);
    const second = buildReviewImportConfirmPayload(parsed, dryRun);
    assert.deepEqual(second, first);
    assert.match(first.payloadHash, /^[0-9a-f]{64}$/);
    assert.equal(first.payload.rows.length, 5);
    assert.equal(first.payload.rows[0].decision, "approve");
    assert.equal(first.payload.rows[1].existing_product_match_id, fixture.reviewedRows[1].existing_product_match_id_reviewed);
    assert.equal(first.payload.rows[2].decision, "defer");
    assert.equal(first.payload.rows[3].decision, "block");

    const expectedResult: ReviewImportConfirmResult = {
      status: "confirmed",
      request_id: "review-import-test-001",
      export_batch_id: fixture.batch.batch.export_batch_id,
      actor_role: "admin_owner",
      total_rows: 5,
      approve_create_new: 1,
      approve_merge_existing: 1,
      defer: 2,
      block: 1,
      rows: [],
    };
    let rpcCalls = 0;
    const fakeClient = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls += 1;
        assert.equal(name, "admin_confirm_product_review_import_batch");
        assert.equal(args.p_actor_user_id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        assert.equal(args.p_request_id, "review-import-test-001");
        assert.deepEqual(args.p_payload, first.payload);
        assert.equal(args.p_payload_hash, first.payloadHash);
        return { data: expectedResult, error: null };
      },
    } as unknown as SupabaseClient;

    const confirmed = await confirmReviewedImportBatch(fakeClient, {
      actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      requestId: "review-import-test-001",
      payload: first.payload,
      payloadHash: first.payloadHash,
    });
    assert.deepEqual(confirmed, expectedResult);
    assert.equal(rpcCalls, 1);
    assert.match(formatConfirmResult(confirmed), /Confirm status: confirmed/);

    const lookupClient = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        assert.equal(name, "admin_get_product_review_import_confirmation");
        assert.equal(args.p_export_batch_id, fixture.batch.batch.export_batch_id);
        assert.equal(args.p_payload_hash, first.payloadHash);
        return { data: expectedResult, error: null };
      },
    } as unknown as SupabaseClient;
    assert.deepEqual(
      await lookupReviewedImportConfirmation(lookupClient, {
        actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        requestId: "review-import-test-001",
        exportBatchId: fixture.batch.batch.export_batch_id,
        payloadHash: first.payloadHash,
      }),
      expectedResult,
    );

    const failedDryRun = {
      ...dryRun,
      summary: { ...dryRun.summary, status: "FAIL" as const },
    };
    assert.throws(
      () => buildReviewImportConfirmPayload(parsed, failedDryRun),
      (error: unknown) =>
        error instanceof ReviewImportConfirmError &&
        error.code === "review_import_confirm_requires_passing_dry_run",
    );

    const errorClient = {
      rpc: async () => ({
        data: null,
        error: { message: "internal SQL detail that must not escape" },
      }),
    } as unknown as SupabaseClient;
    await assert.rejects(
      () =>
        confirmReviewedImportBatch(errorClient, {
          actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          requestId: "review-import-test-002",
          payload: first.payload,
          payloadHash: first.payloadHash,
        }),
      (error: unknown) =>
        error instanceof ReviewImportConfirmError &&
        error.code === "review_import_confirm_failed" &&
        !error.message.includes("SQL"),
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }

  process.stdout.write(
    "verify:product-review-intake-confirm PASS (payload, deterministic hash, RPC boundary, fixed errors, dry-run gate)\n",
  );
}

main().catch((error) => {
  process.stderr.write("verify:product-review-intake-confirm FAIL\n");
  if (error instanceof Error) process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
