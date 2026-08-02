#!/usr/bin/env node
import { alignJudgmentToIntent } from "../alignment.js";
import { deriveG3ConsensusRecord } from "../grades.js";
import { readAndResolveCandidateIntent } from "../read-intent-artifacts.js";
import { readJudgmentConsensus } from "../blind-registrar.js";
import {
  registerDerivedGradeRecord,
  registerIntentAlignment
} from "../alignment-registrar.js";
import { fail, parseArgs, printResult, resolveDataRoot } from "./helpers.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataRoot = resolveDataRoot();
  const candidateId = args.values.get("--candidate");
  const consensusDigest = args.values.get("--consensus-digest");
  const preflight = args.flags.has("--preflight");
  const confirm = args.flags.has("--confirm");
  if (!candidateId || !consensusDigest || preflight === confirm) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  const [consensus, artifacts] = await Promise.all([
    readJudgmentConsensus(dataRoot, candidateId, consensusDigest),
    readAndResolveCandidateIntent({ dataRoot, candidateId })
  ]);
  if (!artifacts.ok) {
    printResult(artifacts);
    process.exitCode = 1;
    return;
  }
  const aligned = alignJudgmentToIntent({
    consensus,
    candidateManifest: artifacts.candidateManifest,
    finalizedSpec: artifacts.finalizedSpec,
    compiledPrompt: artifacts.compiledPrompt
  });
  if (!aligned.ok) {
    printResult(aligned);
    process.exitCode = 1;
    return;
  }
  const g3 = deriveG3ConsensusRecord({ consensus, alignment: aligned.alignment });
  if (!g3.ok) {
    printResult(g3);
    process.exitCode = 1;
    return;
  }
  if (preflight) {
    printResult({
      ok: true,
      proposedAlignmentId: aligned.alignment.alignmentId,
      overallVerdict: aligned.alignment.overallVerdict,
      promotionReviewEligible: aligned.alignment.promotionReviewEligible,
      proposedGradeRecordId: g3.gradeRecord.gradeRecordId,
      writesPerformed: 0
    });
    return;
  }
  const alignmentRegistration = await registerIntentAlignment({ dataRoot, alignment: aligned.alignment });
  const gradeRegistration = await registerDerivedGradeRecord({ dataRoot, gradeRecord: g3.gradeRecord });
  printResult({ ok: true, alignment: alignmentRegistration, grade: gradeRegistration });
}

main().catch(fail);
