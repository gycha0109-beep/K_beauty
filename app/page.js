"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import BottomCTA from "@/components/onboarding/BottomCTA";
import PhotoUploadStep from "@/components/onboarding/PhotoUploadStep";
import LoadingStep from "@/components/onboarding/LoadingStep";
import SurveyFlow from "@/components/onboarding/SurveyFlow";
import ThemeToggle from "@/components/ThemeToggle";
import AuthNav from "@/components/auth/AuthNav";
import { TEST_RESULT_PRESETS, getFaceLabTestPreset, getTestResultPreset } from "@/lib/test-result-presets";
import {
  INITIAL_FORM,
  ONBOARDING_COPY,
  OPTIONAL_DEFAULTS
} from "@/components/onboarding/constants";
import { buildFaceLabLaunchData } from "@/lib/face-lab-launch";
import { clearWriteAccessToken, writeWriteAccessToken } from "@/lib/write-access-client";

const STEP_ORDER = ["photo", "survey", "loading"];
const PRODUCT_SOURCE_UNAVAILABLE_CODE = "PRODUCT_SOURCE_UNAVAILABLE";
const STALE_ANALYSIS_SESSION_KEYS = [
  "skinTestShare",
  "skinTestFaceLabFull",
  "skinTestSubmission",
  "skinTestResult",
  "pendingSaveReport"
];
const STALE_FULL_REPORT_LOCAL_STORAGE_KEYS = [
  "fullReportOpenedAt",
  "lastReportUrl",
  "lastViewedAt",
  "lastFullReportTab"
];
const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const PREMIUM_REPORT_ENABLED =
  IS_DEVELOPMENT || process.env.NEXT_PUBLIC_PREMIUM_REPORT_ENABLED === "true";
const GENDER_PREFERENCE_VALUES = new Set(["female", "male", "unspecified"]);

function clearStaleAnalysisStorage() {
  clearWriteAccessToken();

  if (typeof window === "undefined") {
    return;
  }

  STALE_ANALYSIS_SESSION_KEYS.forEach((key) => {
    sessionStorage.removeItem(key);
  });

  STALE_FULL_REPORT_LOCAL_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });
}

function getAnalyzeErrorMessage(data, copy) {
  if (data?.code === PRODUCT_SOURCE_UNAVAILABLE_CODE) {
    return copy.errors.productSourceUnavailable;
  }

  return data?.error || copy.errors.analyzeFailed;
}

function normalizeSurveyAnswers(form = {}) {
  const mainConcerns = Array.isArray(form.mainConcerns)
    ? form.mainConcerns.filter(Boolean)
    : form.mainConcern
      ? [form.mainConcern]
      : [];

  return {
    ...form,
    mainConcern: form.mainConcern || mainConcerns[0] || "",
    mainConcerns,
    cleansingFrequency: form.cleansingFrequency || OPTIONAL_DEFAULTS.cleansingFrequency,
    preferredTexture: form.preferredTexture || OPTIONAL_DEFAULTS.preferredTexture,
    postWashFeeling: form.postWashFeeling || OPTIONAL_DEFAULTS.postWashFeeling,
    afternoonSkinChange: form.afternoonSkinChange || OPTIONAL_DEFAULTS.afternoonSkinChange,
    mostDislikedFeel: form.mostDislikedFeel || OPTIONAL_DEFAULTS.mostDislikedFeel,
    genderPreference: GENDER_PREFERENCE_VALUES.has(form.genderPreference)
      ? form.genderPreference
      : OPTIONAL_DEFAULTS.genderPreference,
    whiteCastHate: Boolean(form.whiteCastHate),
    toneUpWanted: Boolean(form.toneUpWanted),
    makeupUse: Boolean(form.makeupUse),
    eyeSensitive: Boolean(form.eyeSensitive),
    environmentExposure: Array.isArray(form.environmentExposure)
      ? form.environmentExposure
      : OPTIONAL_DEFAULTS.environmentExposure
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };

    reader.onerror = () => {
      resolve("");
    };

    reader.readAsDataURL(file);
  });
}

async function requestFaceLabResult(file, locale) {
  const payload = new FormData();
  payload.append("image", file);
  payload.append("locale", locale);

  try {
    const response = await fetch("/api/face-reading", {
      method: "POST",
      body: payload
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error("[onboarding] face lab request failed", error);
    return null;
  }
}

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname?.startsWith("/en") ? "en" : "ko";
  const copy = ONBOARDING_COPY[locale] || ONBOARDING_COPY.ko;
  const analyzeStartedRef = useRef(false);
  const stepScrollReadyRef = useRef(false);
  const devMenuCopy = locale === "en"
    ? { toggle: "Test", skin: "Skin Match" }
    : { toggle: "테스트", skin: "Skin Match" };

  const [isDevMode, setIsDevMode] = useState(false);
  const [showTestMenu, setShowTestMenu] = useState(false);
  const [currentStep, setCurrentStep] = useState("photo");
  const [form, setForm] = useState(INITIAL_FORM);
  const [currentProducts, setCurrentProducts] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setIsDevMode(process.env.NODE_ENV !== "production" && params.get("dev") === "1");
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!stepScrollReadyRef.current) {
      stepScrollReadyRef.current = true;
      return;
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== "loading") {
      analyzeStartedRef.current = false;
      return;
    }

    if (analyzeStartedRef.current || !imageFile) {
      return;
    }

    analyzeStartedRef.current = true;

    const runAnalyze = async () => {
      const startedAt = Date.now();
      const completedForm = normalizeSurveyAnswers(form);
      const imagePreviewDataUrlPromise = fileToDataUrl(imageFile);

      try {
        setIsSubmitting(true);
        clearStaleAnalysisStorage();

        const analyzePayload = new FormData();
        analyzePayload.append("image", imageFile);

        Object.entries(completedForm).forEach(([key, value]) => {
          analyzePayload.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
        });
        if (PREMIUM_REPORT_ENABLED && currentProducts.length) {
          analyzePayload.append("currentProducts", JSON.stringify(currentProducts));
        }
        analyzePayload.append("locale", locale);

        const faceLabPromise = requestFaceLabResult(imageFile, locale);
        const response = await fetch("/api/analyze", {
          method: "POST",
          body: analyzePayload
        });

        const data = await response.json().catch(() => null);
        const nextWriteAccessToken = response.headers.get("x-kbeauty-write-token");

        if (!response.ok || !data) {
          throw new Error(getAnalyzeErrorMessage(data, copy));
        }

        writeWriteAccessToken(nextWriteAccessToken);

        const [imagePreviewDataUrl, faceLabResult] = await Promise.all([
          imagePreviewDataUrlPromise,
          faceLabPromise
        ]);
        const faceLabTeaser = faceLabResult
          ? buildFaceLabLaunchData(faceLabResult, locale).free
          : null;

        sessionStorage.setItem(
          "skinTestSubmission",
          JSON.stringify({
            form: completedForm,
            imageName: imageFile?.name || "",
            imagePreviewDataUrl,
            locale
          })
        );
        sessionStorage.setItem(
          "skinTestResult",
          JSON.stringify(faceLabTeaser ? { ...data, faceLab: faceLabTeaser } : data)
        );

        if (faceLabResult) {
          sessionStorage.setItem("skinTestFaceLabFull", JSON.stringify(faceLabResult));
        }

        const elapsed = Date.now() - startedAt;
        const minimumLoading = 1800;

        if (elapsed < minimumLoading) {
          await sleep(minimumLoading - elapsed);
        }

        router.push(locale === "en" ? "/en/result" : "/result");
      } catch (submitError) {
        console.error("[onboarding] analyze failed", submitError);
        setError(submitError.message || copy.errors.unexpected);
        setCurrentStep("survey");
      } finally {
        setIsSubmitting(false);
      }
    };

    void runAnalyze();
  }, [copy.errors.analyzeFailed, copy.errors.unexpected, currentProducts, currentStep, form, imageFile, locale, router]);

  const pageShellClassName = currentStep === "photo"
    ? "mx-auto flex w-full max-w-5xl flex-col px-3 pb-5 pt-2 sm:px-6 sm:pt-4 lg:px-8"
    : currentStep === "survey"
      ? "mx-auto flex w-full max-w-lg flex-col px-4 pb-6 pt-4 sm:px-6"
      : "mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-4 pb-6 pt-4 sm:px-6";
  const stepWrapperClassName = currentStep === "loading"
    ? "step-enter flex flex-1 flex-col"
    : "step-enter flex flex-col";

  const canProceedFromPhoto = Boolean(imageFile);

  const handleSurveyAnswerChange = (name, value) => {
    setForm((prev) => {
      if (name === "mainConcerns") {
        const nextValues = Array.isArray(value) ? value.filter(Boolean) : [];

        return {
          ...prev,
          mainConcern: nextValues[0] || "",
          mainConcerns: nextValues
        };
      }

      if (name === "sunscreenConsiderations") {
        const nextValues = Array.isArray(value) ? value : [];

        return {
          ...prev,
          whiteCastHate: nextValues.includes("whiteCastHate"),
          toneUpWanted: nextValues.includes("toneUpWanted"),
          makeupUse: nextValues.includes("makeupUse"),
          eyeSensitive: nextValues.includes("eyeSensitive")
        };
      }

      return {
        ...prev,
        [name]: value
      };
    });
    setError("");
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (!file) {
      setImageFile(null);
      setPreviewUrl("");
      setError("");
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
  };

  const clearImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setImageFile(null);
    setPreviewUrl("");
    setError("");
  };

  const goToStep = (nextStep) => {
    setError("");
    setCurrentStep(nextStep);
  };

  const handleNext = () => {
    if (currentStep === "photo" && !canProceedFromPhoto) {
      setError(copy.errors.needPhoto);
      return;
    }

    const currentIndex = STEP_ORDER.indexOf(currentStep);
    const nextStep = STEP_ORDER[currentIndex + 1];

    if (nextStep) {
      goToStep(nextStep);
    }
  };

  const handleBack = () => {
    if (currentStep === "loading") {
      return;
    }

    const currentIndex = STEP_ORDER.indexOf(currentStep);
    const previousStep = STEP_ORDER[currentIndex - 1];

    if (previousStep) {
      goToStep(previousStep);
    }
  };

  const handleSkinPresetPreview = (presetId) => {
    const preset = getTestResultPreset(presetId);

    if (!preset) {
      return;
    }

    const faceLabPreset = getFaceLabTestPreset("friendly-coordinator");

    clearStaleAnalysisStorage();
    sessionStorage.setItem("skinTestSubmission", JSON.stringify(preset.submission));
    sessionStorage.setItem(
      "skinTestResult",
      JSON.stringify(faceLabPreset?.result ? { ...preset.result, faceLab: faceLabPreset.result } : preset.result)
    );
    setShowTestMenu(false);
    router.push(locale === "en" ? "/en/result" : "/result");
  };

  const renderStep = () => {
    if (currentStep === "photo") {
      return (
        <PhotoUploadStep
          copy={copy}
          locale={locale}
          imageFile={imageFile}
          previewUrl={previewUrl}
          onImageChange={handleImageChange}
          onClearImage={clearImage}
          error={error}
        />
      );
    }

    if (currentStep === "survey") {
      return (
        <>
          <SurveyFlow
            locale={locale}
            form={form}
            onAnswerChange={handleSurveyAnswerChange}
            onBackToPhoto={() => goToStep("photo")}
            onComplete={() => goToStep("loading")}
            error={error}
          />
        </>
      );
    }

    return <LoadingStep copy={copy} isSubmitting={isSubmitting} />;
  };

  const showBottomCta = currentStep === "photo" && canProceedFromPhoto;

  return (
    <main className="ui-page ui-page-shell flex min-h-screen flex-col">
      <div className={pageShellClassName}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 sm:gap-3 sm:px-0">
          <div className="flex gap-1.5 sm:gap-2">
            {[
              { code: "ko", label: "KO", href: "/" },
              { code: "en", label: "EN", href: "/en" }
            ].map((item) => (
              <Link
                key={item.code}
                href={item.href}
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium transition sm:px-3 sm:py-1.5 sm:text-xs ${
                  locale === item.code
                    ? "ui-choice-active"
                    : "ui-button-secondary-soft"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="relative flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            <AuthNav />
            <ThemeToggle locale={locale} compact />
            {isDevMode ? (
              <button
                type="button"
                onClick={() => setShowTestMenu((current) => !current)}
                className="ui-button-secondary-soft px-3 py-1.5 text-xs font-medium"
              >
                {devMenuCopy.toggle}
              </button>
            ) : null}

            {isDevMode && showTestMenu ? (
              <div className="ui-popover absolute right-0 top-11 z-20 w-[280px] p-3">
                <div>
                  <p className="ui-kicker px-1">{devMenuCopy.skin}</p>
                  <div className="mt-2 space-y-2">
                    {TEST_RESULT_PRESETS.map((preset) => (
                      <button
                        key={`skin-preset-${preset.id}`}
                        type="button"
                        onClick={() => handleSkinPresetPreview(preset.id)}
                        className="ui-button-secondary-muted w-full rounded-2xl px-3 py-3 text-left text-sm font-medium"
                      >
                        {preset.summaryLabel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div key={currentStep} className={stepWrapperClassName}>
          {renderStep()}
        </div>
      </div>

      {showBottomCta ? (
        <BottomCTA
          primaryLabel={
            currentStep === "photo"
              ? copy.cta.next
              : copy.cta.analyze
          }
          onPrimary={handleNext}
          primaryDisabled={!canProceedFromPhoto}
          secondaryLabel={null}
          onSecondary={handleBack}
          tertiaryLabel={null}
          onTertiary={null}
        />
      ) : null}

      <style jsx>{`
        .step-enter {
          animation: step-enter 320ms ease;
        }

        @keyframes step-enter {
          from {
            opacity: 0;
            transform: translateY(18px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
