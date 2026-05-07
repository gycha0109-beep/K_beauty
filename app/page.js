"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import BottomCTA from "@/components/onboarding/BottomCTA";
import ProgressDots from "@/components/onboarding/ProgressDots";
import PhotoUploadStep from "@/components/onboarding/PhotoUploadStep";
import BasicSurveyStep from "@/components/onboarding/BasicSurveyStep";
import ExtraSurveyStep from "@/components/onboarding/ExtraSurveyStep";
import LoadingStep from "@/components/onboarding/LoadingStep";
import { TEST_RESULT_PRESETS, getFaceLabTestPreset, getTestResultPreset } from "@/lib/test-result-presets";
import {
  INITIAL_FORM,
  ONBOARDING_COPY,
  OPTIONAL_DEFAULTS
} from "@/components/onboarding/constants";
import { buildFaceLabLaunchData } from "@/lib/face-lab-launch";
import { clearWriteAccessToken, writeWriteAccessToken } from "@/lib/write-access-client";

const STEP_ORDER = ["photo", "basic", "extra", "loading"];
const PROGRESS_STEPS = ["basic", "extra", "loading"];

function buildCompleteForm(form = {}) {
  const mainConcerns = Array.isArray(form.mainConcerns)
    ? form.mainConcerns.filter(Boolean)
    : form.mainConcern
      ? [form.mainConcern]
      : [];

  return {
    ...form,
    genderPreference: form.genderPreference || "unspecified",
    mainConcern: form.mainConcern || mainConcerns[0] || "",
    mainConcerns,
    cleansingFrequency: form.cleansingFrequency || OPTIONAL_DEFAULTS.cleansingFrequency,
    preferredTexture: form.preferredTexture || OPTIONAL_DEFAULTS.preferredTexture,
    postWashFeeling: form.postWashFeeling || OPTIONAL_DEFAULTS.postWashFeeling,
    afternoonSkinChange: form.afternoonSkinChange || OPTIONAL_DEFAULTS.afternoonSkinChange,
    mostDislikedFeel: form.mostDislikedFeel || OPTIONAL_DEFAULTS.mostDislikedFeel,
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
      const completedForm = buildCompleteForm(form);
      const imagePreviewDataUrlPromise = fileToDataUrl(imageFile);

      try {
        setIsSubmitting(true);
        clearWriteAccessToken();
        sessionStorage.removeItem("skinTestFaceLabFull");

        const analyzePayload = new FormData();
        analyzePayload.append("image", imageFile);

        Object.entries(completedForm).forEach(([key, value]) => {
          analyzePayload.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
        });
        analyzePayload.append("locale", locale);

        const faceLabPromise = requestFaceLabResult(imageFile, locale);
        const response = await fetch("/api/analyze", {
          method: "POST",
          body: analyzePayload
        });

        const data = await response.json().catch(() => null);
        const nextWriteAccessToken = response.headers.get("x-kbeauty-write-token");

        if (!response.ok || !data) {
          throw new Error(data?.error || copy.errors.analyzeFailed);
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
        setCurrentStep("extra");
      } finally {
        setIsSubmitting(false);
      }
    };

    void runAnalyze();
  }, [copy.errors.analyzeFailed, copy.errors.unexpected, currentStep, form, imageFile, locale, router]);

  const progress = useMemo(() => {
    const index = PROGRESS_STEPS.indexOf(currentStep);

    return {
      current: index === -1 ? 0 : index + 1,
      total: PROGRESS_STEPS.length
    };
  }, [currentStep]);

  const mainConcernCount = Array.isArray(form.mainConcerns) ? form.mainConcerns.length : 0;
  const canProceedFromPhoto = Boolean(imageFile);
  const canProceedFromBasic = Boolean(form.skinType && form.sensitivity && mainConcernCount > 0);

  const handleFieldChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleMainConcernToggle = (value) => {
    setForm((prev) => {
      const current = Array.isArray(prev.mainConcerns) ? prev.mainConcerns : [];
      const nextValues = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];

      return {
        ...prev,
        mainConcern: nextValues[0] || "",
        mainConcerns: nextValues
      };
    });
    setError("");
  };

  const handleEnvironmentToggle = (value) => {
    setForm((prev) => {
      const current = Array.isArray(prev.environmentExposure) ? prev.environmentExposure : [];
      const nextValues = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];

      return {
        ...prev,
        environmentExposure: nextValues
      };
    });
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

    if (currentStep === "basic" && !canProceedFromBasic) {
      setError(copy.errors.completeBasicSurvey);
      return;
    }

    if (currentStep === "extra") {
      goToStep("loading");
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

  const handleSkipExtra = () => {
    goToStep("loading");
  };

  const handleSkinPresetPreview = (presetId) => {
    const preset = getTestResultPreset(presetId);

    if (!preset) {
      return;
    }

    const faceLabPreset = getFaceLabTestPreset("friendly-coordinator");

    clearWriteAccessToken();
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

    if (currentStep === "basic") {
      return (
        <BasicSurveyStep
          copy={copy}
          form={form}
          onFieldChange={handleFieldChange}
          onMainConcernToggle={handleMainConcernToggle}
          error={error}
        />
      );
    }

    if (currentStep === "extra") {
      return (
        <ExtraSurveyStep
          copy={copy}
          form={form}
          onFieldChange={handleFieldChange}
          onEnvironmentToggle={handleEnvironmentToggle}
          error={error}
        />
      );
    }

    return <LoadingStep copy={copy} isSubmitting={isSubmitting} />;
  };

  const showProgress = currentStep !== "photo";
  const showBottomCta = currentStep !== "loading";

  return (
    <main className="ui-page ui-page-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-32 pt-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[
              { code: "ko", label: "KO", href: "/" },
              { code: "en", label: "EN", href: "/en" }
            ].map((item) => (
              <Link
                key={item.code}
                href={item.href}
                className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  locale === item.code
                    ? "ui-choice-active"
                    : "ui-button-secondary-soft"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="relative flex items-center gap-2">
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

        {showProgress ? (
          <div className="mb-6 mt-4">
            <ProgressDots current={progress.current} total={progress.total} copy={copy} />
          </div>
        ) : null}

        <div key={currentStep} className="step-enter flex flex-1 flex-col">
          {renderStep()}
        </div>
      </div>

      {showBottomCta ? (
        <BottomCTA
          primaryLabel={
            currentStep === "photo"
              ? copy.cta.next
              : currentStep === "basic"
                ? copy.cta.next
                : copy.cta.analyze
          }
          onPrimary={handleNext}
          primaryDisabled={
            currentStep === "photo"
              ? !canProceedFromPhoto
              : currentStep === "basic"
                ? !canProceedFromBasic
                : false
          }
          secondaryLabel={
            currentStep === "basic" || currentStep === "extra"
              ? copy.cta.back
              : null
          }
          onSecondary={handleBack}
          tertiaryLabel={currentStep === "extra" ? copy.cta.skip : null}
          onTertiary={currentStep === "extra" ? handleSkipExtra : null}
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
