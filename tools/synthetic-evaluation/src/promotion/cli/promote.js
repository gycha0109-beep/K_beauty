#!/usr/bin/env node
import {
  confirmPromotion,
  preparePromotionPolicyReviewPreflight,
  preparePromotionSourcePreflight,
  revokePromotion
} from "../orchestrator.js";
import {
  fail,
  parseArgs,
  printResult,
  readRequestJson,
  resolveDataRoot
} from "../../judgment/cli/helpers.js";

function requireValue(args, name) {
  const value = args.values.get(name);
  if (!value) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modes = ["--source-preflight", "--policy-review-preflight", "--confirm", "--revoke"].filter((flag) => args.flags.has(flag));
  if (modes.length !== 1) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  const dataRoot = resolveDataRoot();

  if (args.flags.has("--revoke")) {
    const request = await readRequestJson(dataRoot, requireValue(args, "--request"), "revocationRequest");
    const result = await revokePromotion({ dataRoot, ...request });
    printResult(result);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  const candidateId = requireValue(args, "--candidate");
  const alignmentDigest = requireValue(args, "--alignment");
  if (args.flags.has("--source-preflight")) {
    const result = await preparePromotionSourcePreflight({ dataRoot, candidateId, alignmentDigest });
    printResult(result.ok ? {
      ok: true,
      promotionKey: result.snapshot.promotionKey,
      sourceSnapshotDigest: result.snapshot.sourceSnapshotDigest,
      purpose: result.snapshot.generation.purpose,
      writesPerformed: 0
    } : result);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  const reviewDrafts = await readRequestJson(dataRoot, requireValue(args, "--policy-reviews"), "policyReviews");
  if (args.flags.has("--policy-review-preflight")) {
    const result = await preparePromotionPolicyReviewPreflight({ dataRoot, candidateId, alignmentDigest, reviewDrafts });
    printResult(result.ok ? {
      ok: true,
      promotionKey: result.snapshot.promotionKey,
      status: result.preflight.status,
      reasonCodes: result.preflight.reasonCodes,
      evidenceBundleDigest: result.bundle.bundleDigest,
      writesPerformed: 0
    } : result);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  const promotionReviewDraft = await readRequestJson(dataRoot, requireValue(args, "--promotion-review"), "promotionReview");
  const result = await confirmPromotion({
    dataRoot,
    candidateId,
    alignmentDigest,
    reviewDrafts,
    promotionReviewDraft,
    predecessorDecisionDigest: args.values.get("--predecessor-decision") || null
  });
  printResult(result);
  if (!result.ok) process.exitCode = 1;
}

main().catch(fail);
