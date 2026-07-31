import fs from "node:fs/promises";
import path from "node:path";

import type { ExportBatchFiles } from "./review-export-contract.js";

const BATCH_FILENAMES = new Set([
  "manifest.csv",
  "evidence.jsonl",
  "batch.json",
  "reviewed-template.csv",
]);

export class ReviewPathError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "ReviewPathError";
    this.code = code;
  }
}

function isWithinRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function assertExistingPathComponentsNotSymlinks(
  root: string,
  target: string,
): Promise<void> {
  const relative = path.relative(root, target);
  let current = root;

  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = await fs.lstat(current).catch(() => null);
    if (!stat) break;
    if (stat.isSymbolicLink()) {
      throw new ReviewPathError("review_path_symlink_forbidden");
    }
  }
}

export async function resolveRepositoryPath(
  repositoryRoot: string,
  requestedPath: string,
  options: { mustExist: boolean; expectFile?: boolean } = { mustExist: false },
): Promise<string> {
  if (
    !requestedPath ||
    path.isAbsolute(requestedPath) ||
    requestedPath.includes("\0") ||
    requestedPath.split(/[\\/]+/).includes("..")
  ) {
    throw new ReviewPathError("review_path_outside_repository");
  }

  const root = path.resolve(repositoryRoot);
  const target = path.resolve(root, requestedPath);
  if (!isWithinRoot(root, target)) {
    throw new ReviewPathError("review_path_outside_repository");
  }

  await assertExistingPathComponentsNotSymlinks(root, target);
  const stat = await fs.lstat(target).catch(() => null);

  if (options.mustExist && !stat) {
    throw new ReviewPathError("review_path_not_found");
  }
  if (stat?.isSymbolicLink()) {
    throw new ReviewPathError("review_path_symlink_forbidden");
  }
  if (options.expectFile && stat && !stat.isFile()) {
    throw new ReviewPathError("review_path_not_file");
  }

  return target;
}

async function clearKnownBatchDirectory(target: string): Promise<void> {
  const entries = await fs.readdir(target, { withFileTypes: true });
  if (
    entries.some(
      (entry) =>
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        !BATCH_FILENAMES.has(entry.name),
    )
  ) {
    throw new ReviewPathError("review_export_overwrite_directory_not_owned");
  }

  for (const entry of entries) {
    await fs.unlink(path.join(target, entry.name));
  }
  await fs.rmdir(target);
}

async function assertKnownBatchDirectory(target: string): Promise<void> {
  const entries = await fs.readdir(target, { withFileTypes: true });
  if (
    entries.some(
      (entry) =>
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        !BATCH_FILENAMES.has(entry.name),
    )
  ) {
    throw new ReviewPathError("review_export_overwrite_directory_not_owned");
  }
}

export async function writeReviewExportBatch(
  repositoryRoot: string,
  requestedOutDir: string,
  files: ExportBatchFiles,
  overwrite: boolean,
): Promise<string> {
  const target = await resolveRepositoryPath(repositoryRoot, requestedOutDir, {
    mustExist: false,
  });
  const targetStat = await fs.lstat(target).catch(() => null);

  if (targetStat) {
    if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) {
      throw new ReviewPathError("review_export_output_path_unsafe");
    }
    if (!overwrite) {
      throw new ReviewPathError("review_export_output_exists");
    }
    await assertKnownBatchDirectory(target);
  }

  const parent = path.dirname(target);
  await fs.mkdir(parent, { recursive: true });
  await assertExistingPathComponentsNotSymlinks(path.resolve(repositoryRoot), parent);

  const temporaryDirectory = path.join(
    parent,
    `.review-export-${files.batch.export_batch_id}.tmp`,
  );
  const temporaryStat = await fs.lstat(temporaryDirectory).catch(() => null);
  if (temporaryStat) {
    throw new ReviewPathError("review_export_temporary_path_exists");
  }

  await fs.mkdir(temporaryDirectory);
  try {
    await Promise.all([
      fs.writeFile(path.join(temporaryDirectory, "manifest.csv"), files.manifestCsv, "utf8"),
      fs.writeFile(path.join(temporaryDirectory, "evidence.jsonl"), files.evidenceJsonl, "utf8"),
      fs.writeFile(path.join(temporaryDirectory, "batch.json"), files.batchJson, "utf8"),
      fs.writeFile(
        path.join(temporaryDirectory, "reviewed-template.csv"),
        files.reviewedTemplateCsv,
        "utf8",
      ),
    ]);
    if (targetStat) {
      await clearKnownBatchDirectory(target);
    }
    await fs.rename(temporaryDirectory, target);
  } catch (error) {
    const entries = await fs.readdir(temporaryDirectory).catch(() => []);
    for (const entry of entries) {
      if (BATCH_FILENAMES.has(entry)) {
        await fs.unlink(path.join(temporaryDirectory, entry)).catch(() => undefined);
      }
    }
    await fs.rmdir(temporaryDirectory).catch(() => undefined);
    throw error;
  }

  return target;
}
