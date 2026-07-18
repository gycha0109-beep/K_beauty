import { NextResponse } from "next/server";
import { formatUploadSize, validateImageUpload } from "@/lib/upload-validation";
import { getOpenAiEnvDiagnostics, resolveOpenAiApiKey } from "@/lib/openai-env-diagnostics";
import { projectFaceLabResult } from "@/lib/face-lab-observation-projector";
import { createFaceLabUnavailable } from "@/lib/face-lab-result-envelope";
import { analyzeVisionObservation } from "@/lib/server/vision-observation-service";
import {
  applyAnalysisGuardCookies,
  completeAnalysisRequestGuard,
  createAnalysisGuardResponse,
  failAnalysisRequestGuard,
  guardAnalysisRequest
} from "@/lib/security/analysis-request-guard";
import { getUploadFingerprintDescriptor } from "@/lib/security/analysis-request-guard-core";

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

function getCopy(locale) {
  return locale === "en" ? COPY.en : COPY.ko;
}

async function completeGuardedResponse(response, guardResult) {
  const completion = await completeAnalysisRequestGuard(guardResult);
  if (!completion.ok) {
    console.warn("[face-reading] analysis guard complete failed");
  }
  return applyAnalysisGuardCookies(response, guardResult);
}

async function failGuardedResponse(response, guardResult) {
  const failure = await failAnalysisRequestGuard(guardResult);
  if (!failure.ok) {
    console.warn("[face-reading] analysis guard fail failed");
  }
  return applyAnalysisGuardCookies(response, guardResult);
}

export async function POST(request) {
  let responseLocale = "ko";
  let analysisGuard = null;

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const locale = formData.get("locale") === "en" ? "en" : "ko";
    responseLocale = locale;
    const copy = getCopy(locale);

    if (!image || typeof image.arrayBuffer !== "function") {
      return NextResponse.json({ error: copy.errorNeedImage }, { status: 400 });
    }

    const imageValidation = validateImageUpload(image);
    if (!imageValidation.ok) {
      return NextResponse.json(
        {
          error: imageValidation.code === "too_large"
            ? copy.imageTooLarge
            : copy.invalidImageType
        },
        { status: 400 }
      );
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

    const { apiKey } = resolveOpenAiApiKey();
    if (process.env.NODE_ENV !== "production") {
      console.info(
        "[face-reading] openai-env:diagnostic",
        getOpenAiEnvDiagnostics({
          route: "face-reading",
          routeUsesOpenAi: true,
          routeUsesOpenRouter: false
        })
      );
    }

    if (!apiKey) {
      return completeGuardedResponse(
        NextResponse.json(createFaceLabUnavailable("api_key_missing")),
        analysisGuard
      );
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    let observation;
    try {
      observation = await analyzeVisionObservation({
        apiKey,
        imageBuffer,
        mimeType: image.type,
        model: MODEL
      });
    } catch {
      return failGuardedResponse(
        NextResponse.json(createFaceLabUnavailable("vision_request_failed")),
        analysisGuard
      );
    }

    const faceLab = projectFaceLabResult(observation.bundle, { locale });
    return completeGuardedResponse(NextResponse.json(faceLab), analysisGuard);
  } catch {
    if (analysisGuard?.ok) {
      await failAnalysisRequestGuard(analysisGuard);
    }

    console.error("[face-reading] request failed", {
      stage: "face-reading",
      ok: false,
      errorCategory: "route_processing_failed"
    });

    return applyAnalysisGuardCookies(
      NextResponse.json({ error: getCopy(responseLocale).serverError }, { status: 500 }),
      analysisGuard
    );
  }
}
