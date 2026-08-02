import path from "node:path";
import { lstat, realpath } from "node:fs/promises";
import { createCandidateImportError } from "@bejewely/face-contracts";

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function validateRelativePath(relativePath) {
  if (
    typeof relativePath !== "string" ||
    !relativePath.trim() ||
    relativePath.includes("\0") ||
    path.isAbsolute(relativePath) ||
    /^[a-zA-Z]:/.test(relativePath) ||
    relativePath.startsWith("\\\\")
  ) {
    return false;
  }
  const segments = relativePath.replace(/\\/g, "/").split("/");
  return segments.every((segment) => segment && segment !== "." && segment !== "..");
}

export async function resolveSafeContainedFile(rootPath, relativePath, errorPath) {
  if (!validateRelativePath(relativePath)) {
    return { ok: false, errors: [createCandidateImportError("unsafe_source_path", errorPath)] };
  }

  try {
    const rootRealPath = await realpath(rootPath);
    const segments = relativePath.replace(/\\/g, "/").split("/");
    let current = rootRealPath;
    for (const segment of segments) {
      current = path.join(current, segment);
      const info = await lstat(current);
      if (info.isSymbolicLink()) {
        return { ok: false, errors: [createCandidateImportError("symlink_forbidden", errorPath)] };
      }
    }
    const targetRealPath = await realpath(current);
    if (!isInside(rootRealPath, targetRealPath)) {
      return { ok: false, errors: [createCandidateImportError("unsafe_source_path", errorPath)] };
    }
    const targetInfo = await lstat(targetRealPath);
    if (!targetInfo.isFile()) {
      return { ok: false, errors: [createCandidateImportError("source_not_found", errorPath)] };
    }
    return { ok: true, absolutePath: targetRealPath, rootRealPath };
  } catch (error) {
    return {
      ok: false,
      errors: [createCandidateImportError("source_not_found", errorPath, error?.code || null)]
    };
  }
}
