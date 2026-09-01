import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
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
  const router = useRouter();
  const { locale, palette } = useMobileShell();
  const copy = MOBILE_COPY[locale].analyze;
  const [cameraRevision, setCameraRevision] = useState(0);
  const [capturedPhoto, setCapturedPhoto] = useState<NativeCameraPhoto | null>(null);
  const [survey, setSurvey] = useState<SurveyFormInput>(createInitialSurvey);
  const [result, setResult] = useState<NativeAnalyzeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setResult(null);
    setErrorMessage("");
    if (!capturedPhoto) {
      setSurvey(createInitialSurvey());
    }
  }, [capturedPhoto]);

  const resetAnalysis = useCallback(() => {
    setCapturedPhoto(null);
    setSurvey(createInitialSurvey());
    setResult(null);
    setSubmitting(false);
    setErrorMessage("");
    setCameraRevision((current) => current + 1);
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
    ? "정면 피부 사진을 촬영하고 짧은 설문에 답하면 BEJEWELY가 맞춤 피부 분석을 준비합니다."
    : "Take a clear front-facing skin photo and answer a short survey to get your personalized BEJEWELY analysis.";

  return (
    <ScreenShell eyebrow={locale === "ko" ? "피부 분석" : "SKIN ANALYSIS"} title={copy.title} description={description}>
      <Text style={[styles.notice, { color: palette.textMuted }]}>
        {locale === "ko"
          ? "최종 사진과 설문은 ‘피부 분석 실행’을 눌렀을 때만 분석을 위해 전송됩니다. 촬영 가이드용 임시 이미지는 전송하지 않습니다."
          : "Your final photo and survey are sent for analysis only when you tap Run skin analysis. Temporary camera-guidance images are not uploaded."}
      </Text>

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
              acceptPhoto: locale === "ko" ? "이 사진 사용" : "Use photo",
              localOnly: locale === "ko"
                ? "촬영한 사진은 분석을 시작하기 전까지 기기에만 유지됩니다. 분석을 실행할 때만 전송됩니다."
                : "Your captured photo stays on your device until you start analysis. It is sent only when analysis begins."
            }}
            palette={palette}
            onPhotoChange={setCapturedPhoto}
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
                  ? "결과가 마음에 들지 않으면 사진을 다시 촬영하거나 처음부터 다시 시작할 수 있습니다."
                  : "You can retake your photo or start over at any time."}
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
