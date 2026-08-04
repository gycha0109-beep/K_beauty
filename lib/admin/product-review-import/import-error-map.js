export const PRODUCT_REVIEW_IMPORT_ERROR_MESSAGES = Object.freeze({
  unauthorized: "관리자 로그인이 필요합니다.",
  forbidden: "제품 검수 import 권한이 없습니다.",
  invalid_origin: "현재 관리자 화면에서 다시 시도해 주세요.",
  invalid_content_type: "업로드 요청 형식이 올바르지 않습니다.",
  request_too_large: "업로드 파일 크기가 허용 범위를 초과했습니다.",
  missing_file: "batch.json, manifest.csv, evidence.jsonl, reviewed.csv를 모두 선택해 주세요.",
  duplicate_file: "같은 업로드 항목이 중복되었습니다.",
  unexpected_file: "예상하지 않은 업로드 항목이 포함되었습니다.",
  invalid_utf8: "파일은 NUL byte가 없는 UTF-8 형식이어야 합니다.",
  invalid_batch: "batch.json 계약을 확인해 주세요.",
  invalid_manifest: "manifest.csv 계약과 무결성을 확인해 주세요.",
  invalid_evidence: "evidence.jsonl 계약과 무결성을 확인해 주세요.",
  invalid_reviewed_file: "reviewed.csv의 필수 값과 허용값을 수정해 주세요.",
  file_hash_mismatch: "export 파일 조합이 일치하지 않습니다. 같은 batch의 파일을 다시 선택해 주세요.",
  payload_hash_mismatch: "dry-run 이후 파일이 변경되었습니다. 새 dry-run을 실행해 주세요.",
  dry_run_failed: "dry-run 검증을 통과하지 못했습니다.",
  stale_candidate: "후보가 변경되었습니다. 새 export가 필요합니다.",
  stale_review: "검토 큐가 변경되었습니다. 새 export가 필요합니다.",
  stale_evidence: "근거가 변경되었습니다. 새 export가 필요합니다.",
  identity_conflict: "제품 identity 충돌이 있습니다. reviewed.csv를 수정해 주세요.",
  request_conflict: "같은 request ID가 다른 파일에 사용되었습니다.",
  batch_already_confirmed: "이 export batch는 이미 반영되었습니다.",
  confirm_failed: "반영 transaction을 완료하지 못했습니다. 같은 request ID로 다시 시도할 수 있습니다.",
  unexpected_error: "관리자 import 작업을 완료하지 못했습니다."
});

const PUBLIC_CODES = new Set(Object.keys(PRODUCT_REVIEW_IMPORT_ERROR_MESSAGES));

export class ProductReviewImportError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = "ProductReviewImportError";
    this.code = PUBLIC_CODES.has(code) ? code : "unexpected_error";
    this.status = status;
  }
}

export function mapProductReviewImportCode(value, fallback = "unexpected_error") {
  const code = typeof value === "string" ? value : "";
  if (PUBLIC_CODES.has(code)) return code;

  if (code.includes("request_id_conflict")) return "request_conflict";
  if (code.includes("batch_already_confirmed")) return "batch_already_confirmed";
  if (code.includes("stale_candidate")) return "stale_candidate";
  if (code.includes("stale_review") || code.includes("review_queue")) return "stale_review";
  if (code.includes("stale_evidence") || code.includes("evidence_version")) return "stale_evidence";
  if (code.includes("identity") || code.includes("product_match_conflict")) return "identity_conflict";
  if (code.includes("payload_hash")) return "payload_hash_mismatch";
  if (code.includes("manifest_hash") || code.includes("evidence_hash") || code.includes("candidate_ids_mismatch")) {
    return "file_hash_mismatch";
  }
  if (code.includes("batch")) return "invalid_batch";
  if (code.includes("manifest")) return "invalid_manifest";
  if (code.includes("evidence")) return "invalid_evidence";
  if (code.includes("utf") || code.includes("unreadable")) return "invalid_utf8";
  if (code.includes("reviewed") || code.includes("review_import_confirm_requires_passing_dry_run")) {
    return "invalid_reviewed_file";
  }
  if (code.includes("capability") || code.includes("access_required")) return "forbidden";
  if (code.includes("confirm")) return "confirm_failed";
  return PUBLIC_CODES.has(fallback) ? fallback : "unexpected_error";
}

export function getProductReviewImportMessage(code) {
  return (
    PRODUCT_REVIEW_IMPORT_ERROR_MESSAGES[code] ||
    PRODUCT_REVIEW_IMPORT_ERROR_MESSAGES.unexpected_error
  );
}

export function publicImportError(error, fallback = "unexpected_error") {
  const mapped = mapProductReviewImportCode(error?.code || error?.message, fallback);
  const status = Number.isInteger(error?.status) ? error.status : mapped === "request_too_large" ? 413 : 400;
  return {
    code: mapped,
    message: getProductReviewImportMessage(mapped),
    status
  };
}
