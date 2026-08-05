import { NextResponse } from "next/server";
import { projectFaceLabResult } from "@/lib/face-lab-observation-projector";
import { createFaceLabUnavailable } from "@/lib/face-lab-result-envelope";
import { resolveOpenAiApiKey } from "@/lib/openai-env-diagnostics";
import {
  applyAnalysisGuardCookies,
  completeAnalysisRequestGuard,
  createAnalysisGuardResponse,
  failAnalysisRequestGuard,
  guardAnalysisRequest
} from "@/lib/security/analysis-request-guard";
import { getUploadFingerprintDescriptor } from "@/lib/security/analysis-request-guard-core";
import {
  createNoStoreHeaders,
  writeSafeLog
} from "@/lib/security/error-redaction";
import { canonicalizeImageFile } from "@/lib/server/image-upload-boundary";
import { analyzeVisionObservation } from "@/lib/server/vision-observation-service";
import {
  formatUploadSize,
  validateImageRequestContentLength,
  validateImageUpload
} from "@/lib/upload-validation";

const MODEL = "gpt-4o-mini";

const COPY = {
  ko: {
    errorNeedImage: "얼굴 사진이 필요합니다.",
    invalidImageType: "JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.",
    imageTooLarge: `이미지 용량은 ${formatUploadSize()} 이하만 업로드할 수 있습니다.`,
    serverError: "Face Lab 처리 중 오류가 발생했습니다."
  },
  en: {
    errorNeedImage: "A face photo is required.",
    invalidImageType: "Only JPEG, PNG, and WEBP images are allowed.",
    imageTooLarge: `Images must be ${formatUploadSize()} or smaller.`,
    serverError: "Something went wrong while generating Face Lab."
  }
};

function getCopy(locale = "ko") {
  return COPY[locale] || COPY.ko;
}

function sensitiveJsonResponse(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: createNoStoreHeaders(init.headers)
  });
}

async function completeGuardedResponse(response, guardResult) {
  const completion = await completeAnalysisRequestGuard(guardResult);

  if (!completion.ok) {
    writeSafeLog("warn", {
      event: "face_reading_failed",
      category: "internal_error",
      operation: "face_reading",
      dependency: "application",
      retryable: false
    });
  }

  return applyAnalysisGuardCookies(response, guardResult);
}

async function failGuardedResponse(response, guardResult) {
  const failure = await failAnalysisRequestGuard(guardResult);

  if (!failure.ok) {
    writeSafeLog("warn", {
      event: "face_reading_failed",
      category: "internal_error",
      operation: "face_reading",
      dependency: "application",
      retryable: false
    });
  }

  return applyAnalysisGuardCookies(response, guardResult);
}

export async function POST(request) {
  let responseLocale = "ko";
  let analysisGuard = null;

  try {
    const contentLengthValidation = validateImageRequestContentLength(request);

    if (!contentLengthValidation.ok) {
      const copy = getCopy(responseLocale);
      const errorMessage = contentLengthValidation.code === "too_large"
        ? copy.imageTooLarge
        : copy.invalidImageType;

      return sensitiveJsonResponse({ error: errorMessage }, { status: 400 });
    }

    const formData = await request.formData();
    const image = formData.get("image");
    const locale = formData.get("locale") === "en" ? "en" : "ko";
    responseLocale = locale;
    const copy = getCopy(locale);

    if (!image || typeof image.arrayBuffer !== "function") {
      return sensitiveJsonResponse({ error: copy.errorNeedImage }, { status: 400 });
    }

    const imageValidation = validateImageUpload(image);
    if (!imageValidation.ok) {
      const errorMessage = imageValidation.code === "too_large"
        ? copy.imageTooLarge
        : copy.invalidImageType;

      return sensitiveJsonResponse({ error: errorMessage }, { status: 400 });
    }

    analysisGuard = await guardAnalysisRequest({
      request,
      endpoint: "face-reading",
      fingerprintInput: {
        locale,
        image: getUploadFingerprintDescriptor(image)
      }
    });

    if (!analysisGuard.ok) {
      return createAnalysisGuardResponse(analysisGuard, locale);
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const canonicalImage = await canonicalizeImageFile(image, imageBuffer);

    if (!canonicalImage.ok) {
      return failGuardedResponse(
        sensitiveJsonResponse({ error: copy.invalidImageType }, { status: 400 }),
        analysisGuard
      );
    }

    const { apiKey } = resolveOpenAiApiKey();
    if (!apiKey) {
      return completeGuardedResponse(
        sensitiveJsonResponse(createFaceLabUnavailable("api_key_missing")),
        analysisGuard
      );
    }

    let observation;
    try {
      observation = await analyzeVisionObservation({
        apiKey,
        imageBuffer: canonicalImage.bytes,
        mimeType: canonicalImage.mimeType,
        model: MODEL
      });
    } catch {
      return failGuardedResponse(
        sensitiveJsonResponse(createFaceLabUnavailable("vision_request_failed")),
        analysisGuard
      );
    }

    const faceLab = projectFaceLabResult(observation.bundle, { locale });
    return completeGuardedResponse(sensitiveJsonResponse(faceLab), analysisGuard);
  } catch {
    if (analysisGuard?.ok) {
      await failAnalysisRequestGuard(analysisGuard);
    }

    writeSafeLog("error", {
      event: "face_reading_failed",
      category: "internal_error",
      operation: "face_reading",
      dependency: "application",
      retryable: false
    });

    return applyAnalysisGuardCookies(
      sensitiveJsonResponse(
        { error: getCopy(responseLocale).serverError },
        { status: 500 }
      ),
      analysisGuard
    );
  }
}
