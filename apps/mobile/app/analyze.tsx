import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused, useRouter } from "expo-router";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenShell } from "../components/ScreenShell";
import {
  isNativeAnalyzeFormReady,
  NativeAnalyzeRequestError,
  createNativeAnalyzeIdempotencyKey,
  submitNativeAnalyze,
  type NativeAnalyzeResult
} from "../features/analyze/analyze-client";
import { NativeAnalyzeResultView } from "../features/analyze/NativeAnalyzeResult";
import { NativeAnalyzeSurvey } from "../features/analyze/NativeAnalyzeSurvey";
import { NativeFaceCamera, type NativeCameraPhoto } from "../features/camera/NativeFaceCamera";
import { MOBILE_COPY } from "../lib/copy";
import { useMobileShell } from "../lib/mobile-shell";
import { observeNativeSession } from "../lib/auth";
import { cleanupNativePhoto } from "../lib/photo-cache";
import { createNativeRequestScope } from "../lib/request-scope";
import {
  SURVEY_INITIAL_FORM,
  SURVEY_OPTIONAL_DEFAULTS,
  normalizeSurveyAnswers,
  type SurveyFormInput
} from "../lib/survey-contract";

function createInitialSurvey(): SurveyFormInput {
  return {
    ...SURVEY_INITIAL_FORM,
    ...SURVEY_OPTIONAL_DEFAULTS
  };
}

export default function AnalyzeScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { locale, palette } = useMobileShell();
  const copy = MOBILE_COPY[locale].analyze;
  const [cameraRevision, setCameraRevision] = useState(0);
  const [capturedPhoto, setCapturedPhotoState] = useState<NativeCameraPhoto | null>(null);
  const [survey, setSurveyState] = useState<SurveyFormInput>(createInitialSurvey);
  const [result, setResult] = useState<NativeAnalyzeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const consentRef = useRef(false);
  const [retryReadyAt, setRetryReadyAt] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const retryAtRef = useRef(0);
  const requests = useRef(createNativeRequestScope()).current;
  const photoRef = useRef<NativeCameraPhoto | null>(null);
  const surveyRef = useRef(survey);
  const keyRef = useRef<string | null>(null);
  const submissionLock = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const previousLocale = useRef(locale);
  const draftRevision = useRef(0);
  const renderedRevision = draftRevision.current;

  const stopWaiting = useCallback(() => {
    if (!submissionLock.current) return;
    requests.begin("analysis");
    abortRef.current?.abort(); abortRef.current = null;
    submissionLock.current = false; setSubmitting(false);
    setErrorMessage(locale === "ko"
      ? "기다림을 중단했습니다. 서버 처리는 계속될 수 있습니다. 같은 입력으로 다시 확인하거나 저장 리포트를 확인해 주세요."
      : "Waiting stopped. Server processing may continue. Check again with the same input or open your saved report.");
  }, [locale, requests]);

  useEffect(() => {
    if (!isFocused) stopWaiting();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") stopWaiting();
    });
    return () => subscription.remove();
  }, [isFocused, stopWaiting]);

  const invalidateDraft = useCallback(() => {
    draftRevision.current += 1;
    requests.invalidate(); abortRef.current?.abort();
    submissionLock.current = false; keyRef.current = null;
    consentRef.current = false; retryAtRef.current = 0;
    setSubmitting(false); setConsentAccepted(false); setRetryReadyAt(0); setRetrySeconds(0);
    setResult(null);
    setErrorMessage("");
  }, [requests]);

  const setCapturedPhoto = useCallback((next: NativeCameraPhoto | null) => {
    const previous = photoRef.current;
    if (previous?.uri !== next?.uri || next === null) {
      invalidateDraft();
      if (previous) void cleanupNativePhoto(previous.uri);
    }
    photoRef.current = next; setCapturedPhotoState(next);
    if (!next) { const initial = createInitialSurvey(); surveyRef.current = initial; setSurveyState(initial); }
  }, [invalidateDraft]);

  const setSurvey = useCallback((next: SurveyFormInput) => {
    if (JSON.stringify(normalizeSurveyAnswers(next)) !== JSON.stringify(normalizeSurveyAnswers(surveyRef.current))) invalidateDraft();
    surveyRef.current = next; setSurveyState(next);
  }, [invalidateDraft]);

  const resetAnalysis = useCallback(() => {
    setCapturedPhoto(null);
    setCameraRevision((current) => current + 1);
  }, [setCapturedPhoto]);

  useEffect(() => {
    const stop = observeNativeSession((session) => {
      if (requests.setOwner(session?.user.id ?? null)) resetAnalysis();
    });
    return () => {
      stop(); requests.invalidate(); abortRef.current?.abort();
      if (photoRef.current) void cleanupNativePhoto(photoRef.current.uri);
      photoRef.current = null; consentRef.current = false; submissionLock.current = false;
    };
  }, [requests, resetAnalysis]);

  useEffect(() => {
    if (previousLocale.current !== locale && !result) invalidateDraft();
    previousLocale.current = locale;
  }, [locale, result, invalidateDraft]);

  useEffect(() => {
    if (!retryReadyAt) return;
    const update = () => setRetrySeconds(Math.max(0, Math.ceil((retryReadyAt - Date.now()) / 1000)));
    update(); const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [retryReadyAt]);

  const handleAnalyze = useCallback(async () => {
    if (renderedRevision !== draftRevision.current || !capturedPhoto || photoRef.current?.uri !== capturedPhoto.uri || submitting || submissionLock.current ||
      !consentAccepted || !consentRef.current || Date.now() < retryAtRef.current ||
      !isNativeAnalyzeFormReady(survey)) return;

    const ticket = requests.begin("analysis");
    const controller = new AbortController();
    abortRef.current = controller; submissionLock.current = true;
    const idempotencyKey = keyRef.current ?? createNativeAnalyzeIdempotencyKey();
    keyRef.current = idempotencyKey;
    setSubmitting(true);
    setErrorMessage("");

    try {
      const nextResult = await submitNativeAnalyze({
        photo: capturedPhoto,
        form: survey,
        locale,
        idempotencyKey,
        consentAccepted: true,
        expectedUserId: ticket.owner,
        signal: controller.signal
      });
      if (requests.isCurrent(ticket)) {
        setResult(nextResult);
        void cleanupNativePhoto(capturedPhoto.uri);
      }
    } catch (error) {
      if (!requests.isCurrent(ticket)) return;
      const message = error instanceof NativeAnalyzeRequestError
        ? error.message
        : locale === "ko"
          ? "피부 분석을 완료하지 못했습니다. 다시 시도해 주세요."
          : "The skin analysis could not be completed. Please try again.";
      setErrorMessage(message);
      if (error instanceof NativeAnalyzeRequestError && error.retryAfterSeconds) {
        retryAtRef.current = Date.now() + error.retryAfterSeconds * 1000;
        setRetryReadyAt(retryAtRef.current);
      }
    } finally {
      if (requests.isCurrent(ticket)) { setSubmitting(false); submissionLock.current = false; abortRef.current = null; }
    }
  }, [capturedPhoto, consentAccepted, locale, renderedRevision, requests, retryReadyAt, submitting, survey]);

  return (
    <ScreenShell eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <Text style={[styles.notice, { color: palette.textMuted }]}>{copy.notice}</Text>

      {result ? (
        <NativeAnalyzeResultView
          result={result}
          locale={locale}
          palette={palette}
          onStartOver={resetAnalysis}
          onOpenPremium={() => router.push("/premium")}
        />
      ) : (
        <>
          <NativeFaceCamera
            key={cameraRevision}
            copy={{
              ...copy.camera,
              previewLabel: copy.title,
              acceptPhoto: locale === "ko" ? "이 사진 사용" : "Use photo"
            }}
            palette={{ ...palette, accent: palette.action }}
            disabled={submitting}
            onPhotoChange={setCapturedPhoto}
          />

          {capturedPhoto ? (
            <View style={styles.analyzeFlow}>
              <NativeAnalyzeSurvey
                form={survey}
                locale={locale}
                palette={{ ...palette, accent: palette.accentText }}
                disabled={submitting}
                onChange={(next) => { if (renderedRevision === draftRevision.current) setSurvey(next); }}
              />

              <View style={[styles.dataUse, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                <Text style={[styles.dataUseTitle, { color: palette.text }]}>{locale === "ko" ? "사진·설문 전송 안내" : "Photo and answer sharing"}</Text>
                <Text style={[styles.notice, { color: palette.textMuted }]}>{locale === "ko"
                  ? "최종 얼굴 사진과 설문 답변을 BEJEWELY 서버로 전송합니다. AI 분석이 활성화된 경우 OpenAI가 사진과 분석에 필요한 정보를 처리해 피부 관찰과 스킨케어 가이드를 생성합니다. 얼굴 위치 안내는 기기 안에서 처리합니다."
                  : "Your final face photo and survey answers are sent to BEJEWELY. When AI analysis is enabled, OpenAI processes the photo and necessary analysis information to generate skin observations and skincare guidance. Face-framing guidance stays on your device."}</Text>
                <Text style={[styles.boundary, { color: palette.textMuted }]}>{locale === "ko"
                  ? "정보 보관·삭제와 외부 서비스 처리 기준은 개인정보 처리방침에서 확인해 주세요."
                  : "Review the privacy policy for retention, deletion, and external service processing."}</Text>
                <Pressable accessibilityRole="link" onPress={() => router.push("/privacy-account")} style={styles.dataUseAction}>
                  <Text style={{ color: palette.accentText }}>{locale === "ko" ? "개인정보 처리방침 확인" : "Review privacy policy"}</Text>
                </Pressable>
                <Pressable testID="native-analyze-consent" accessibilityRole="checkbox"
                  accessibilityState={{ checked: consentAccepted, disabled: submitting }} disabled={submitting}
                  onPress={() => {
                    if (submissionLock.current || renderedRevision !== draftRevision.current) return;
                    consentRef.current = !consentRef.current; setConsentAccepted(consentRef.current);
                  }} style={styles.dataUseAction}>
                  <Text style={{ color: palette.text }}>{consentAccepted ? "☑" : "☐"} {locale === "ko"
                    ? "사진·설문의 전송과 위에 안내된 외부 AI 처리에 동의합니다."
                    : "I agree to sending my photo and answers and to the external AI processing described above."}</Text>
                </Pressable>
              </View>

              {errorMessage ? (
                <Text
                  testID="native-analyze-error"
                  accessibilityLiveRegion="polite"
                  style={[styles.error, { color: palette.text }]}
                >
                  {errorMessage}
                </Text>
              ) : null}

              <Pressable
                testID="native-analyze-submit"
                accessibilityRole="button"
                accessibilityState={{
                  disabled: submitting || !consentAccepted || retrySeconds > 0 || !isNativeAnalyzeFormReady(survey)
                }}
                disabled={submitting || !consentAccepted || retrySeconds > 0 || !isNativeAnalyzeFormReady(survey)}
                onPress={handleAnalyze}
                style={({ pressed }) => [
                  styles.submitButton,
                  {
                    backgroundColor: palette.action,
                    opacity: submitting || !consentAccepted || retrySeconds > 0 || !isNativeAnalyzeFormReady(survey)
                      ? 0.42
                      : pressed
                        ? 0.72
                        : 1
                  }
                ]}
              >
                <Text style={styles.submitButtonText}>
                  {submitting
                    ? locale === "ko" ? "분석 중…" : "Analyzing…"
                    : locale === "ko" ? "피부 분석 시작" : "Start skin analysis"}
                </Text>
              </Pressable>

              {retrySeconds > 0 ? <Text accessibilityLiveRegion="polite" style={{ color: palette.textMuted }}>{locale === "ko" ? `${retrySeconds}초 후 다시 확인할 수 있습니다.` : `Check again in ${retrySeconds} seconds.`}</Text> : null}
              {submitting ? <Pressable accessibilityRole="button" onPress={stopWaiting} style={styles.dataUseAction}>
                <Text style={{ color: palette.text }}>{locale === "ko" ? "기다림 중단" : "Stop waiting"}</Text>
              </Pressable> : null}
              {errorMessage ? <Pressable accessibilityRole="button" onPress={resetAnalysis} style={styles.dataUseAction}>
                <Text style={{ color: palette.text }}>{locale === "ko" ? "새 분석 시작" : "Start a new analysis"}</Text>
              </Pressable> : null}

              <Text style={[styles.boundary, { color: palette.textMuted }]}>
                {locale === "ko"
                  ? "결과는 현재 피부 상태와 선호를 바탕으로 한 스킨케어 가이드와 제품 추천으로 제공됩니다."
                  : "Your result is presented as skin-care guidance and product recommendations based on your current skin profile and preferences."}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  notice: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4
  },
  analyzeFlow: {
    gap: 14
  },
  dataUse: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  dataUseTitle: { fontSize: 16, fontWeight: "700" },
  dataUseAction: { minHeight: 48, justifyContent: "center", paddingVertical: 10 },
  error: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700"
  },
  submitButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    paddingHorizontal: 18
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  },
  boundary: {
    fontSize: 12,
    lineHeight: 18
  }
});
