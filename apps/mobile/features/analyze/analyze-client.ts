import type { SupportedLocale } from "@bejewely/shared";

import type { NativeCameraPhoto } from "../camera/NativeFaceCamera";
import { getNativeSession } from "../../lib/auth";
import { getMobileApiBaseUrl } from "../../lib/env";
import { fetchWithTimeout, MOBILE_ANALYZE_TIMEOUT_MS, NativeTransportError } from "../../lib/request";
import { retainNativePhoto } from "../../lib/photo-cache";
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
  consentAccepted?: boolean;
  expectedUserId?: string | null;
  signal?: AbortSignal;
}): Promise<NativeAnalyzeResult> {
  if (input.consentAccepted !== true) {
    throw new NativeAnalyzeRequestError("mobile_analyze_consent_required",
      input.locale === "ko" ? "사진과 설문 전송에 동의해 주세요." : "Please consent to sending your photo and answers.");
  }
  const { payload } = buildNativeAnalyzeFormData(input.photo, input.form, input.locale);
  const idempotencyKey = input.idempotencyKey || createNativeAnalyzeIdempotencyKey();
  const session = await getNativeSession();
  if (input.expectedUserId !== undefined && (session?.user.id ?? null) !== input.expectedUserId) {
    throw new NativeAnalyzeRequestError("mobile_analyze_account_changed",
      input.locale === "ko" ? "계정이 변경되었습니다. 새 분석을 시작해 주세요." : "Your account changed. Start a new analysis.");
  }
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Idempotency-Key": idempotencyKey
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  let response: Response;
  const releasePhoto = retainNativePhoto(input.photo.uri);

  try {
    response = await fetchWithTimeout(`${getMobileApiBaseUrl()}/api/analyze`, {
      method: "POST",
      headers,
      body: payload,
      credentials: "include",
      signal: input.signal
    }, MOBILE_ANALYZE_TIMEOUT_MS, releasePhoto);
  } catch (error) {
    if (error instanceof NativeTransportError) {
      throw new NativeAnalyzeRequestError(error.code,
        input.locale === "ko"
          ? "결과를 기다리기를 중단했습니다. 서버에서는 분석이 진행 중일 수 있습니다. 같은 입력으로 다시 확인해 주세요."
          : "Waiting stopped. The server may still be processing. Retry with the same input to check.");
    }
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
    const knownMessages: Record<string, [string, string]> = {
      analysis_request_in_progress: ["이 요청은 이미 처리 중입니다. 새 분석을 만들지 말고 잠시 후 같은 입력으로 확인해 주세요.", "This request is already processing. Wait and check with the same input."],
      analysis_request_already_completed: ["서버에서 이 요청의 처리가 완료되었습니다. 응답을 다시 받을 수 없는 경우 저장 리포트를 확인해 주세요. 자동으로 새 분석을 실행하지 않습니다.", "The server completed this request. If the response was lost, check your saved reports. A new analysis will not run automatically."],
      analysis_idempotency_conflict: ["재시도할 입력이 이전 요청과 다릅니다. 새 분석을 명시적으로 시작해 주세요.", "The retry input differs from the original request. Start a new analysis explicitly."],
      analysis_request_failed: ["이전 요청을 완료하지 못했습니다. 잠시 후 같은 입력으로 확인해 주세요.", "The earlier request did not complete. Wait and check with the same input."]
    };
    const message = knownMessages[code]?.[input.locale === "ko" ? 0 : 1] ?? (typeof responsePayload?.message === "string"
      ? responsePayload.message
      : typeof responsePayload?.error === "string" && !responsePayload.error.includes("_")
        ? responsePayload.error
        : input.locale === "ko"
          ? "피부 분석을 완료하지 못했습니다. 다시 시도해 주세요."
          : "The skin analysis could not be completed. Please try again.");

    const headerDelay = response.headers.get("Retry-After");
    const seconds = responsePayload?.retryAfterSeconds ?? (headerDelay && /^\d+$/.test(headerDelay)
      ? Number(headerDelay) : headerDelay ? Math.ceil((Date.parse(headerDelay) - Date.now()) / 1000) : null);

    throw new NativeAnalyzeRequestError(code, message, {
      status: response.status,
      retryAfterSeconds: seconds !== null && Number.isFinite(Number(seconds)) && Number(seconds) >= 0
        ? Number(seconds)
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

  return responsePayload;
}
