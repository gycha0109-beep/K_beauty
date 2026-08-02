#!/usr/bin/env node
import { createBlindJudgmentAssignment } from "../assignment.js";
import { finalizeJudgmentSubmission } from "../submission.js";
import { registerJudgmentSubmission } from "../registrar.js";
import { fail, parseArgs, printResult, readRequestJson, resolveDataRoot } from "./helpers.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataRoot = resolveDataRoot();
  if (args.flags.has("--issue")) {
    const inputPath = args.values.get("--blind-input");
    if (!inputPath) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const blindInput = await readRequestJson(dataRoot, inputPath, "blindInput");
    const result = createBlindJudgmentAssignment(blindInput);
    printResult(result.ok ? { ok: true, assignment: result.assignment, writesPerformed: 0 } : result);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  const assignmentPath = args.values.get("--assignment");
  const submissionPath = args.values.get("--submission");
  if (!assignmentPath || !submissionPath || (args.flags.has("--preflight") === args.flags.has("--submit"))) {
    throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  }
  const [assignment, draft] = await Promise.all([
    readRequestJson(dataRoot, assignmentPath, "assignment"),
    readRequestJson(dataRoot, submissionPath, "submission")
  ]);
  if (args.flags.has("--preflight")) {
    const result = finalizeJudgmentSubmission({ assignment, draft });
    printResult(result.ok ? { ok: true, proposedSubmissionId: result.submission.submissionId, proposedSubmissionDigest: result.submission.submissionDigest, writesPerformed: 0 } : result);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  const result = await registerJudgmentSubmission({ dataRoot, assignment, draft });
  printResult(result);
  if (!result.ok) process.exitCode = 1;
}

main().catch(fail);
