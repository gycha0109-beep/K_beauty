import { randomUUID } from "node:crypto";

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: PRODUCT_REVIEW_IMPORT_NO_STORE_HEADERS
  });
}

function accessError(access, requestId) {
  if (!access?.authenticated || !access?.accountUser) {
    return json(
      {
        ok: false,
        status: "invalid",
        error: "unauthorized",
        message: getProductReviewImportMessage("unauthorized"),
        requestId,
        retryable: false
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
        message: getProductReviewImportMessage("forbidden"),
        requestId,
        retryable: false
      },
      403
    );
  }
  return null;
}

function failure(error, fallback, requestId) {
  const safe = publicImportError(error, fallback);
  return json(
    {
      ok: false,
      status: "invalid",
      error: safe.code,
      message: safe.message,
      requestId,
      retryable: safe.retryable
    },
    safe.status
  );
}

function safeSubmittedRequestId(value, fallback) {
  return UUID_PATTERN.test(String(value || "")) ? String(value) : fallback;
}

async function evaluateOrigin(request, isAllowedOrigin, requestId) {
  try {
    if (!isAllowedOrigin(request)) {
      return failure({ code: "invalid_origin", status: 403 }, "invalid_origin", requestId);
    }
  } catch {
    return failure({ code: "unexpected_error", status: 500 }, "unexpected_error", requestId);
  }
  return null;
}

async function evaluateAccess(resolveAccess, requestId) {
  let access;
  try {
    access = await resolveAccess();
  } catch {
    return {
      access: null,
      response: failure(
        { code: "unexpected_error", status: 500 },
        "unexpected_error",
        requestId
      )
    };
  }
  return { access, response: accessError(access, requestId) };
}

export function createProductReviewImportDryRunHandler({
  resolveAccess,
  isAllowedOrigin,
  parseMultipart,
  parsePackage,
  executeDryRun
}) {
  return async function POST(request) {
    const operationRequestId = randomUUID();

    const originDenied = await evaluateOrigin(
      request,
      isAllowedOrigin,
      operationRequestId
    );
    if (originDenied) return originDenied;

    const { access, response: accessDenied } = await evaluateAccess(
      resolveAccess,
      operationRequestId
    );
    if (accessDenied) return accessDenied;
    if (!access) {
      return failure(
        { code: "unexpected_error", status: 500 },
        "unexpected_error",
        operationRequestId
      );
    }

    try {
      const { files } = await parseMultipart(request, { allowedTextFields: [] });
      const parsed = parsePackage(files);
      return json(await executeDryRun(parsed, operationRequestId));
    } catch (error) {
      return failure(error, "dry_run_failed", operationRequestId);
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
    const operationRequestId = randomUUID();

    const originDenied = await evaluateOrigin(
      request,
      isAllowedOrigin,
      operationRequestId
    );
    if (originDenied) return originDenied;

    const { access, response: accessDenied } = await evaluateAccess(
      resolveAccess,
      operationRequestId
    );
    if (accessDenied) return accessDenied;
    if (!access) {
      return failure(
        { code: "unexpected_error", status: 500 },
        "unexpected_error",
        operationRequestId
      );
    }

    let responseRequestId = operationRequestId;
    try {
      const { files, fields } = await parseMultipart(request, {
        allowedTextFields: [
          "requestId",
          "expectedReviewedFileSha256",
          "expectedCanonicalPayloadSha256",
          "confirmation"
        ]
      });
      responseRequestId = safeSubmittedRequestId(
        fields.requestId,
        operationRequestId
      );
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
      return failure(error, "confirm_failed", responseRequestId);
    }
  };
}
