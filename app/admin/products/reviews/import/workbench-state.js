export const PRODUCT_REVIEW_IMPORT_STATES = Object.freeze({
  IDLE: "idle",
  FILES_SELECTED: "files_selected",
  VALIDATING: "validating",
  DRY_RUN_INVALID: "dry_run_invalid",
  DRY_RUN_READY: "dry_run_ready",
  CONFIRMING: "confirming",
  CONFIRMED: "confirmed",
  ALREADY_CONFIRMED: "already_confirmed",
  FAILED: "failed"
});

export const INITIAL_PRODUCT_REVIEW_IMPORT_STATE = Object.freeze({
  status: PRODUCT_REVIEW_IMPORT_STATES.IDLE,
  filesRevision: 0,
  dryRun: null,
  requestId: null,
  reviewedFileSha256: null,
  canonicalPayloadSha256: null,
  result: null,
  error: null
});

function isFileLike(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    typeof value.name === "string" &&
    Number.isFinite(value.size) &&
    typeof value.arrayBuffer === "function";
}

export function hasAllProductReviewImportFiles(files) {
  return ["batch", "manifest", "evidence", "reviewed"].every(
    (field) => isFileLike(files?.[field])
  );
}

export function canConfirmProductReviewImport(state, confirmation) {
  return Boolean(
    (
      state.status === PRODUCT_REVIEW_IMPORT_STATES.DRY_RUN_READY ||
      state.status === PRODUCT_REVIEW_IMPORT_STATES.FAILED
    ) &&
      state.dryRun?.status === "ready" &&
      state.requestId &&
      state.reviewedFileSha256 &&
      state.canonicalPayloadSha256 &&
      confirmation === "CONFIRM_PRODUCT_REVIEW_IMPORT"
  );
}

export function productReviewImportReducer(state, action) {
  switch (action.type) {
    case "files_changed":
      return {
        ...INITIAL_PRODUCT_REVIEW_IMPORT_STATE,
        status: action.complete
          ? PRODUCT_REVIEW_IMPORT_STATES.FILES_SELECTED
          : PRODUCT_REVIEW_IMPORT_STATES.IDLE,
        filesRevision: state.filesRevision + 1
      };
    case "dry_run_started":
      return {
        ...INITIAL_PRODUCT_REVIEW_IMPORT_STATE,
        status: PRODUCT_REVIEW_IMPORT_STATES.VALIDATING,
        filesRevision: state.filesRevision
      };
    case "dry_run_completed":
      return {
        ...state,
        status: action.payload.status === "ready"
          ? PRODUCT_REVIEW_IMPORT_STATES.DRY_RUN_READY
          : PRODUCT_REVIEW_IMPORT_STATES.DRY_RUN_INVALID,
        dryRun: action.payload,
        requestId: action.payload.requestId || null,
        reviewedFileSha256: action.payload.reviewedFileSha256 || null,
        canonicalPayloadSha256: action.payload.canonicalPayloadSha256 || null,
        result: null,
        error: action.payload.status === "invalid" ? action.payload.error || null : null
      };
    case "dry_run_failed":
      return {
        ...state,
        status: PRODUCT_REVIEW_IMPORT_STATES.FAILED,
        dryRun: null,
        requestId: null,
        reviewedFileSha256: null,
        canonicalPayloadSha256: null,
        result: null,
        error: action.error
      };
    case "confirm_started":
      return {
        ...state,
        status: PRODUCT_REVIEW_IMPORT_STATES.CONFIRMING,
        error: null
      };
    case "confirm_completed":
      return {
        ...state,
        status: action.payload.status === "already_confirmed"
          ? PRODUCT_REVIEW_IMPORT_STATES.ALREADY_CONFIRMED
          : PRODUCT_REVIEW_IMPORT_STATES.CONFIRMED,
        result: action.payload,
        error: null
      };
    case "confirm_failed":
      return {
        ...state,
        status: PRODUCT_REVIEW_IMPORT_STATES.FAILED,
        result: null,
        error: action.error
      };
    default:
      return state;
  }
}
