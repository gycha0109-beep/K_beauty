#!/usr/bin/env node
import { buildJudgmentConsensus } from "../consensus.js";
import {
  readJudgmentSubmissionByDigest,
  registerJudgmentConsensus
} from "../blind-registrar.js";
import { fail, parseArgs, printResult, readRequestJson, resolveDataRoot } from "./helpers.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataRoot = resolveDataRoot();
  const assignmentPath = args.values.get("--assignment");
  const digestList = args.values.get("--submission-digests");
  const preflight = args.flags.has("--preflight");
  const build = args.flags.has("--build");
  if (!assignmentPath || !digestList || preflight === build) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  const digests = digestList.split(",").map((value) => value.trim()).filter(Boolean);
  if (digests.length < 2 || new Set(digests).size !== digests.length) throw Object.assign(new Error("insufficient_independent_reviewers"), { code: "insufficient_independent_reviewers" });
  const assignment = await readRequestJson(dataRoot, assignmentPath, "assignment");
  const submissions = await Promise.all(digests.map((digest) => readJudgmentSubmissionByDigest(dataRoot, digest)));
  const adjudicatorDigest = args.values.get("--adjudicator-digest") || null;
  const adjudicatorSubmission = adjudicatorDigest ? await readJudgmentSubmissionByDigest(dataRoot, adjudicatorDigest) : null;
  if (preflight) {
    const result = buildJudgmentConsensus({ assignment, submissions, adjudicatorSubmission });
    printResult(result.ok ? { ok: true, proposedConsensusId: result.consensus.consensusId, status: result.consensus.status, writesPerformed: 0 } : result);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  const result = await registerJudgmentConsensus({ dataRoot, assignment, submissions, adjudicatorSubmission });
  printResult(result);
  if (!result.ok) process.exitCode = 1;
}

main().catch(fail);
