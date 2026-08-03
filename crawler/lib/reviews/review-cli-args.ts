import {
  DEFAULT_EXPORT_LIMIT,
  EXPORT_STATUSES,
  MAX_EXPORT_LIMIT,
  type ExportStatus,
} from "./review-export-contract.js";
import { isUuid } from "./review-batch-integrity.js";

export class ReviewCliArgumentError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "ReviewCliArgumentError";
    this.code = code;
  }
}

function parseTokens(
  argv: string[],
  valueOptions: Set<string>,
  booleanOptions: Set<string>,
): Map<string, string | true> {
  const values = new Map<string, string | true>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--") || token === "--") {
      throw new ReviewCliArgumentError("review_cli_unexpected_argument");
    }

    const key = token.slice(2);
    if (!valueOptions.has(key) && !booleanOptions.has(key)) {
      throw new ReviewCliArgumentError("review_cli_unknown_option");
    }
    if (values.has(key)) {
      throw new ReviewCliArgumentError("review_cli_duplicate_option");
    }

    if (booleanOptions.has(key)) {
      values.set(key, true);
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      throw new ReviewCliArgumentError("review_cli_missing_option_value");
    }
    values.set(key, next);
    index += 1;
  }

  return values;
}

export interface ReviewExportCliOptions {
  status: ExportStatus;
  outDir: string;
  limit: number;
  candidateId?: string;
  overwrite: boolean;
}

export function parseReviewExportArgs(argv: string[]): ReviewExportCliOptions {
  const values = parseTokens(
    argv,
    new Set(["status", "out-dir", "limit", "candidate-id"]),
    new Set(["overwrite"]),
  );
  const status = String(values.get("status") ?? "");
  const outDir = String(values.get("out-dir") ?? "");

  if (!EXPORT_STATUSES.includes(status as ExportStatus)) {
    throw new ReviewCliArgumentError("review_export_status_invalid");
  }
  if (!outDir) {
    throw new ReviewCliArgumentError("review_export_out_dir_required");
  }

  const rawLimit = values.get("limit");
  const limit = rawLimit === undefined ? DEFAULT_EXPORT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_EXPORT_LIMIT) {
    throw new ReviewCliArgumentError("review_export_limit_invalid");
  }

  const candidateIdValue = values.get("candidate-id");
  const candidateId =
    typeof candidateIdValue === "string" ? candidateIdValue.trim() : undefined;
  if (candidateId && !isUuid(candidateId)) {
    throw new ReviewCliArgumentError("review_export_candidate_id_invalid");
  }

  return {
    status: status as ExportStatus,
    outDir,
    limit,
    candidateId,
    overwrite: values.get("overwrite") === true,
  };
}

export type ReviewedImportCliOptions = {
  file: string;
  mode: "dry-run";
} | {
  file: string;
  mode: "confirm";
  actorUserId: string;
  requestId: string;
};

export function parseReviewedImportArgs(argv: string[]): ReviewedImportCliOptions {
  const values = parseTokens(
    argv,
    new Set(["file", "actor-user-id", "request-id"]),
    new Set(["dry-run", "confirm"]),
  );
  const file = String(values.get("file") ?? "");

  if (!file) {
    throw new ReviewCliArgumentError("review_import_file_required");
  }
  const dryRun = values.get("dry-run") === true;
  const confirm = values.get("confirm") === true;
  if (dryRun === confirm) {
    throw new ReviewCliArgumentError("review_import_mode_required");
  }

  if (dryRun) {
    if (values.has("actor-user-id") || values.has("request-id")) {
      throw new ReviewCliArgumentError("review_import_dry_run_option_conflict");
    }
    return { file, mode: "dry-run" };
  }

  const actorUserId = String(values.get("actor-user-id") ?? "").trim();
  const requestId = String(values.get("request-id") ?? "").trim();
  if (!isUuid(actorUserId)) {
    throw new ReviewCliArgumentError("review_import_actor_user_id_invalid");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(requestId)) {
    throw new ReviewCliArgumentError("review_import_request_id_invalid");
  }

  return { file, mode: "confirm", actorUserId, requestId };
}
