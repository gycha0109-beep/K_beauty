import type { SupportedLocale } from "@bejewely/shared";

import type { NativeCameraPhoto } from "../camera/NativeFaceCamera";
import { getNativeSession } from "../../lib/auth";
import { getMobileApiBaseUrl } from "../../lib/env";
import { hasForbiddenMobileAnalyzeMedicalClaim } from "../../lib/health-claims";
import { normalizeSurveyAnswers, type SurveyFormInput } from "../../lib/survey-contract";

export type NativeAnalyzeProduct = Readonly<{
  id?: string;
  name?: string;
  brand?: string;
  category?: string;
  reason?: string;
  comparison_reason?: string;
  image_url?: string;
  buy_link?: string;
}>;

export type NativeAnalyzeResult = Readonly<{
  summary: string;
  priority?: unknown;
  topPick: NativeAnalyzeProduct | null;
  alternative?: NativeAnalyzeProduct | null;
  amFocus?: string;
  pmFocus?: string;
  routineStructure?: unknown;
  morning: unknown[];
  night: unknown[];
  warnings?: unknown[];
  photoEvidence?: unknown[];
  photoObservations?: unknown;
  photoEvidenceState?: unknown;
  imageEligibility?: unknown;
  surveyEvidence?: unknown[];
  scoring?: unknown;
  faceLab?: unknown;
  analysisRunId?: string;
  meta?: Readonly<{
    schemaVersion?: number;
    source?: string;
    locale?: SupportedLocale;
    generatedAt?: string;
    notice?: string;
    explanationSource?: string;
    photoEvidenceSource?: string;
    photoObservationsSource?: string;
    visionObservationSchemaVersion?: string | null;
    visionObservationPromptVersion?: string | null;
    imageProviderAttemptCount?: number;
  }>;
}>;

export class NativeAnalyzeRequestError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: string,
    message: string,
    options: { status?: number | null; retryAfterSeconds?: number | null } = {}
  ) {
    super(message);
    this.name = "NativeAnalyzeRequestError";
    this.code = code;
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

export const NATIVE_ANALYZE_REQUIRED_FIELDS = [
  "skinType",
  "sensitivity",
  "mainConcern",
  "cleansingFrequency",
  "preferredTexture",
  "postWashFeeling",
  "afternoonSkinChange",
  "mostDislikedFeel"
] as const;

function serializeMultipartValue(value: unknown) {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value == null) {
    return "";
  }

  return String(value);
}

export function createNativeAnalyzeIdempotencyKey(
  now = Date.now(),
  randomValue = Math.random()
) {
  const randomPart = Math.max(0, Math.min(0.9999999999999999, randomValue))
    .toString(36)
    .slice(2, 14)
    .padEnd(12, "0");
  return `mobile-analyze-${now.toString(36)}-${randomPart}`;
}

export function buildNativeAnalyzeFormData(
  photo: NativeCameraPhoto,
  form: SurveyFormInput,
  locale: SupportedLocale
) {
  const normalized = normalizeSurveyAnswers(form);
  const payload = new FormData();

  payload.append(
    "image",
    {
      uri: photo.uri,
      name: photo.name,
      type: photo.type
    } as any
  );

  Object.entries(normalized).forEach(([key, value]) => {
    payload.append(key, serializeMultipartValue(value));
  });
  payload.append("locale", locale);

  return {
    payload,
    normalized
  };
}

export function isNativeAnalyzeFormReady(form: SurveyFormInput) {
  const normalized = normalizeSurveyAnswers(form) as Record<string, unknown>;
  return NATIVE_ANALYZE_REQUIRED_FIELDS.every((field) => {
    const value = normalized[field];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function isAnalyzeResult(value: unknown): value is NativeAnalyzeResult {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.summary === "string" &&
    Object.prototype.hasOwnProperty.call(payload, "topPick") &&
    Array.isArray(payload.morning) &&
    Array.isArray(payload.night)
  );
}

async function readResponseJson(response: Response) {
  return response.json().catch(() => null) as Promise<Record<string, any> | null>;
}

export async function submitNativeAnalyze(input: {
  photo: NativeCameraPhoto;
  form: SurveyFormInput;
  locale: SupportedLocale;
  idempotencyKey?: string;
}): Promise<NativeAnalyzeResult> {
  const { payload } = buildNativeAnalyzeFormData(input.photo, input.form, input.locale);
  const idempotencyKey = input.idempotencyKey || createNativeAnalyzeIdempotencyKey();
  const session = await getNativeSession();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Idempotency-Key": idempotencyKey
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${getMobileApiBaseUrl()}/api/analyze`, {
      method: "POST",
      headers,
      body: payload,
      credentials: "include"
    });
  } catch {
    throw new NativeAnalyzeRequestError(
      "mobile_analyze_network_failed",
      input.locale === "ko"
        ? "분석 서버에 연결하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요."
        : "Could not reach the analysis server. Check your connection and try again."
    );
  }

  const responsePayload = await readResponseJson(response);

  if (!response.ok) {
    const code = typeof responsePayload?.error === "string"
      ? responsePayload.error
      : typeof responsePayload?.code === "string"
        ? responsePayload.code
        : "mobile_analyze_request_failed";
    const message = typeof responsePayload?.message === "string"
      ? responsePayload.message
      : typeof responsePayload?.error === "string" && !responsePayload.error.includes("_")
        ? responsePayload.error
        : input.locale === "ko"
          ? "피부 분석을 완료하지 못했습니다. 다시 시도해 주세요."
          : "The skin analysis could not be completed. Please try again.";

    throw new NativeAnalyzeRequestError(code, message, {
      status: response.status,
      retryAfterSeconds: Number.isFinite(Number(responsePayload?.retryAfterSeconds))
        ? Number(responsePayload?.retryAfterSeconds)
        : null
    });
  }

  if (!isAnalyzeResult(responsePayload)) {
    throw new NativeAnalyzeRequestError(
      "mobile_analyze_invalid_response",
      input.locale === "ko"
        ? "분석 결과 형식을 확인할 수 없습니다. 새 분석을 시작해 주세요."
        : "The analysis result format is invalid. Please start a new analysis.",
      { status: response.status }
    );
  }

  if (hasForbiddenMobileAnalyzeMedicalClaim(responsePayload as Record<string, unknown>)) {
    throw new NativeAnalyzeRequestError(
      "mobile_analyze_medical_claim_guard",
      input.locale === "ko"
        ? "의료적 판단으로 오해될 수 있는 결과는 표시하지 않습니다. 새 분석을 시작해 주세요."
        : "A result that could be mistaken for medical guidance was blocked. Please start a new analysis.",
      { status: response.status }
    );
  }

  return responsePayload;
}
