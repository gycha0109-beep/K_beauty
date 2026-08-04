import {
  getProductReviewImportMessage,
  publicImportError
} from "./import-error-map.js";

export const PRODUCT_REVIEW_IMPORT_NO_STORE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  Pragma: "no-cache"
});

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: PRODUCT_REVIEW_IMPORT_NO_STORE_HEADERS
  });
}

function accessError(access) {
  if (!access?.authenticated || !access?.accountUser) {
    return json(
      {
        ok: false,
        status: "invalid",
        error: "unauthorized",
        message: getProductReviewImportMessage("unauthorized")
      },
      401
    );
  }
  if (!access.allowed || !access.userId) {
    return json(
      {
        ok: false,
        status: "invalid",
        error: "forbidden",
        message: getProductReviewImportMessage("forbidden")
      },
      403
    );
  }
  return null;
}

function failure(error, fallback) {
  const safe = publicImportError(error, fallback);
  return json(
    {
      ok: false,
      status: "invalid",
      error: safe.code,
      message: safe.message
    },
    safe.status
  );
}

export function createProductReviewImportDryRunHandler({
  resolveAccess,
  isAllowedOrigin,
  parseMultipart,
  parsePackage,
  executeDryRun
}) {
  return async function POST(request) {
    let access;
    try {
      access = await resolveAccess();
    } catch {
      return failure({ code: "unexpected_error", status: 500 }, "unexpected_error");
    }
    const denied = accessError(access);
    if (denied) return denied;
    try {
      if (!isAllowedOrigin(request)) {
        return failure({ code: "invalid_origin", status: 403 }, "invalid_origin");
      }
    } catch {
      return failure({ code: "unexpected_error", status: 500 }, "unexpected_error");
    }

    try {
      const { files } = await parseMultipart(request, { allowedTextFields: [] });
      const parsed = parsePackage(files);
      return json(await executeDryRun(parsed));
    } catch (error) {
      return failure(error, "dry_run_failed");
    }
  };
}

export function createProductReviewImportConfirmHandler({
  resolveAccess,
  isAllowedOrigin,
  parseMultipart,
  parsePackage,
  executeConfirm
}) {
  return async function POST(request) {
    let access;
    try {
      access = await resolveAccess();
    } catch {
      return failure({ code: "unexpected_error", status: 500 }, "unexpected_error");
    }
    const denied = accessError(access);
    if (denied) return denied;
    try {
      if (!isAllowedOrigin(request)) {
        return failure({ code: "invalid_origin", status: 403 }, "invalid_origin");
      }
    } catch {
      return failure({ code: "unexpected_error", status: 500 }, "unexpected_error");
    }

    try {
      const { files, fields } = await parseMultipart(request, {
        allowedTextFields: [
          "requestId",
          "expectedReviewedFileSha256",
          "expectedCanonicalPayloadSha256",
          "confirmation"
        ]
      });
      const parsed = parsePackage(files);
      const result = await executeConfirm({
        parsed,
        actorUserId: access.userId,
        requestId: fields.requestId,
        expectedReviewedFileSha256: fields.expectedReviewedFileSha256,
        expectedCanonicalPayloadSha256: fields.expectedCanonicalPayloadSha256,
        confirmation: fields.confirmation
      });
      return json(result);
    } catch (error) {
      return failure(error, "confirm_failed");
    }
  };
}
