import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenShell } from "../components/ScreenShell";
import {
  isNativeAnalyzeFormReady,
  NativeAnalyzeRequestError,
  submitNativeAnalyze,
  type NativeAnalyzeResult
} from "../features/analyze/analyze-client";
import { NativeAnalyzeResultView } from "../features/analyze/NativeAnalyzeResult";
import { NativeAnalyzeSurvey } from "../features/analyze/NativeAnalyzeSurvey";
import { NativeFaceCamera, type NativeCameraPhoto } from "../features/camera/NativeFaceCamera";
import { MOBILE_COPY } from "../lib/copy";
import { useMobileShell } from "../lib/mobile-shell";
import {
  SURVEY_INITIAL_FORM,
  SURVEY_OPTIONAL_DEFAULTS,
  type SurveyFormInput
} from "../lib/survey-contract";

function createInitialSurvey(): SurveyFormInput {
  return {
    ...SURVEY_INITIAL_FORM,
    ...SURVEY_OPTIONAL_DEFAULTS
  };
}

export default function AnalyzeScreen() {
  const { locale, palette } = useMobileShell();
  const copy = MOBILE_COPY[locale].analyze;
  const [cameraRevision, setCameraRevision] = useState(0);
  const [capturedPhoto, setCapturedPhoto] = useState<NativeCameraPhoto | null>(null);
  const [survey, setSurvey] = useState<SurveyFormInput>(createInitialSurvey);
  const [result, setResult] = useState<NativeAnalyzeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const resetAnalysis = useCallback(() => {
    setCapturedPhoto(null);
    setSurvey(createInitialSurvey());
    setResult(null);
    setSubmitting(false);
    setErrorMessage("");
    setCameraRevision((current) => current + 1);
  }, []);

  const handlePhotoChange = useCallback((photo: NativeCameraPhoto | null) => {
    setCapturedPhoto(photo);
    setResult(null);
    setErrorMessage("");
    if (!photo) {
      setSurvey(createInitialSurvey());
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!capturedPhoto || submitting || !isNativeAnalyzeFormReady(survey)) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      const nextResult = await submitNativeAnalyze({
        photo: capturedPhoto,
        form: survey,
        locale
      });
      setResult(nextResult);
    } catch (error) {
      const message = error instanceof NativeAnalyzeRequestError
        ? error.message
        : locale === "ko"
          ? "피부 분석을 완료하지 못했습니다. 다시 시도해 주세요."
          : "The skin analysis could not be completed. Please try again.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }, [capturedPhoto, locale, submitting, survey]);

  const description = locale === "ko"
    ? "전면 카메라의 기기 내 촬영 가이드와 공용 설문 계약을 사용하고, 최종 JPEG만 기존 BEJEWELY 분석 서버로 전송합니다."
    : "Use on-device front-camera guidance and the shared survey contract, then send only the final JPEG to the existing BEJEWELY analysis server.";

  return (
    <ScreenShell eyebrow="ANALYZE · MOBILE-7" title={copy.title} description={description}>
      <Text style={[styles.notice, { color: palette.textMuted }]}>
        {locale === "ko"
          ? "분석을 실행할 때만 촬영한 최종 사진과 설문값이 /api/analyze로 전송됩니다. 가이드용 임시 샘플은 업로드하지 않습니다."
          : "Only when you run analysis are the final photo and survey values sent to /api/analyze. Temporary guidance samples are never uploaded."}
      </Text>

      {result ? (
        <NativeAnalyzeResultView
          result={result}
          locale={locale}
          palette={palette}
          onStartOver={resetAnalysis}
        />
      ) : (
        <>
          <NativeFaceCamera
            key={cameraRevision}
            copy={{
              ...copy.camera,
              previewLabel: copy.title,
              localOnly: locale === "ko"
                ? "촬영한 최종 사진은 분석을 실행하기 전까지 로컬 캐시에 유지됩니다. 분석 실행 시에만 기존 BEJEWELY 서버로 전송됩니다."
                : "The final photo stays in local cache until you run analysis. It is sent to the existing BEJEWELY server only when analysis starts."
            }}
            palette={palette}
            onPhotoChange={handlePhotoChange}
          />

          {capturedPhoto ? (
            <View style={styles.analyzeFlow}>
              <NativeAnalyzeSurvey
                form={survey}
                locale={locale}
                palette={palette}
                disabled={submitting}
                onChange={setSurvey}
              />

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
                  disabled: submitting || !isNativeAnalyzeFormReady(survey)
                }}
                disabled={submitting || !isNativeAnalyzeFormReady(survey)}
                onPress={handleAnalyze}
                style={({ pressed }) => [
                  styles.submitButton,
                  {
                    backgroundColor: palette.accent,
                    opacity: submitting || !isNativeAnalyzeFormReady(survey)
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
                    : locale === "ko" ? "피부 분석 실행" : "Run skin analysis"}
                </Text>
              </Pressable>

              <Text style={[styles.boundary, { color: palette.textMuted }]}>
                {locale === "ko"
                  ? "추천·Product Fact·Face Lab·Premium 판단은 서버 권한으로 유지됩니다. 앱은 결과를 계산하거나 재작성하지 않습니다."
                  : "Recommendation, Product Fact, Face Lab, and Premium decisions remain server authority. The app does not calculate or rewrite the result."}
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
