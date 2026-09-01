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
            </View>
          ) : null}
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  notice: {
    fontSize: 14,
    lineHeight: 21,
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
  }
});
