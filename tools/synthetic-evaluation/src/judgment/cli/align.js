#!/usr/bin/env node
import {
  registerDerivedGradeRecord,
  registerIntentAlignment
} from "../alignment-registrar.js";
import { prepareStoredJudgmentAlignment } from "../stored-alignment.js";
import { fail, parseArgs, printResult, resolveDataRoot } from "./helpers.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataRoot = resolveDataRoot();
  const candidateId = args.values.get("--candidate");
  const consensusDigest = args.values.get("--consensus-digest");
  const preflight = args.flags.has("--preflight");
  const confirm = args.flags.has("--confirm");
  if (!candidateId || !consensusDigest || preflight === confirm) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });

  const prepared = await prepareStoredJudgmentAlignment({ dataRoot, candidateId, consensusDigest });
  if (!prepared.ok) {
    printResult(prepared);
    process.exitCode = 1;
    return;
  }
  if (preflight) {
    printResult({
      ok: true,
      proposedAlignmentId: prepared.alignment.alignmentId,
      overallVerdict: prepared.alignment.overallVerdict,
      promotionReviewEligible: prepared.alignment.promotionReviewEligible,
      proposedG2RecordId: prepared.g2.gradeRecordId,
      proposedG3RecordId: prepared.g3.gradeRecordId,
      writesPerformed: 0
    });
    return;
  }
  const alignmentRegistration = await registerIntentAlignment({ dataRoot, alignment: prepared.alignment });
  const [g2Registration, g3Registration] = await Promise.all([
    registerDerivedGradeRecord({ dataRoot, gradeRecord: prepared.g2 }),
    registerDerivedGradeRecord({ dataRoot, gradeRecord: prepared.g3 })
  ]);
  printResult({
    ok: true,
    alignment: alignmentRegistration,
    grades: { g2: g2Registration, g3: g3Registration }
  });
}

main().catch(fail);
