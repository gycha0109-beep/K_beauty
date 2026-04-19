"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import FaceLab from "@/components/FaceLab";
import BottomCTA from "@/components/onboarding/BottomCTA";
import ProgressDots from "@/components/onboarding/ProgressDots";
import PhotoUploadStep from "@/components/onboarding/PhotoUploadStep";
import BasicSurveyStep from "@/components/onboarding/BasicSurveyStep";
import ExtraSurveyStep from "@/components/onboarding/ExtraSurveyStep";
import LoadingStep from "@/components/onboarding/LoadingStep";
import {
  FACE_LAB_TEST_PRESETS,
  TEST_RESULT_PRESETS,
  getFaceLabTestPreset,
  getTestResultPreset
} from "@/lib/test-result-presets";
import {
  INITIAL_FORM,
  ONBOARDING_COPY,
  OPTIONAL_DEFAULTS
} from "@/components/onboarding/constants";
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
    mainConcern: form.mainConcern || mainConcerns[0] || "",
    mainConcerns,
    cleansingFrequency: form.cleansingFrequency || OPTIONAL_DEFAULTS.cleansingFrequency,
    preferredTexture: form.preferredTexture || OPTIONAL_DEFAULTS.preferredTexture,
    postWashFeeling: form.postWashFeeling || OPTIONAL_DEFAULTS.postWashFeeling,
    afternoonSkinChange: form.afternoonSkinChange || OPTIONAL_DEFAULTS.afternoonSkinChange,
    mostDislikedFeel: form.mostDislikedFeel || OPTIONAL_DEFAULTS.mostDislikedFeel,
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

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname?.startsWith("/en") ? "en" : "ko";
  const copy = ONBOARDING_COPY[locale] || ONBOARDING_COPY.ko;
  const analyzeStartedRef = useRef(false);

  const [mode, setMode] = useState("skin");
  const [showTestMenu, setShowTestMenu] = useState(false);
  const [currentStep, setCurrentStep] = useState("photo");
  const [form, setForm] = useState(INITIAL_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [faceLabLoading, setFaceLabLoading] = useState(false);
  const [faceLabError, setFaceLabError] = useState("");
  const [faceLabResult, setFaceLabResult] = useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (currentStep !== "loading" || mode !== "skin") {
      analyzeStartedRef.current = false;
      return;
    }

    if (analyzeStartedRef.current) {
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

        const payload = new FormData();
        payload.append("image", imageFile);

        Object.entries(completedForm).forEach(([key, value]) => {
          payload.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
        });
        payload.append("locale", locale);

        const response = await fetch("/api/analyze", {
          method: "POST",
          body: payload
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data) {
          throw new Error(data?.error || copy.errors.analyzeFailed);
        }

        writeWriteAccessToken(data.writeAccessToken);

        const imagePreviewDataUrl = await imagePreviewDataUrlPromise;

        sessionStorage.setItem(
          "skinTestSubmission",
          JSON.stringify({
            form: completedForm,
            imageName: imageFile?.name || "",
            imagePreviewDataUrl,
            locale
          })
        );
        sessionStorage.setItem("skinTestResult", JSON.stringify(data));

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
  }, [copy.errors.analyzeFailed, copy.errors.unexpected, currentStep, form, imageFile, locale, mode, router]);

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
      setFaceLabError("");
      setFaceLabResult(null);
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
    setFaceLabError("");
    setFaceLabResult(null);
  };

  const clearImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setImageFile(null);
    setPreviewUrl("");
    setError("");
    setFaceLabError("");
    setFaceLabResult(null);
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

  const handleOpenFaceLab = () => {
    setMode("face-lab");
    setShowTestMenu(false);
  };

  const handleOpenSkin = () => {
    setMode("skin");
    setCurrentStep("photo");
    setShowTestMenu(false);
  };

  const handleFaceLabAnalyze = async () => {
    if (!imageFile) {
      setFaceLabError(copy.errors.needPhoto);
      return;
    }

    setFaceLabError("");
    setFaceLabLoading(true);

    try {
      const payload = new FormData();
      payload.append("image", imageFile);
      payload.append("locale", locale);

      const response = await fetch("/api/face-reading", {
        method: "POST",
        body: payload
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data) {
        throw new Error(copy.faceLab.errorLoad);
      }

      setFaceLabResult(data);
    } catch (requestError) {
      console.error("[face-lab] analyze failed", requestError);
      setFaceLabResult(null);
      setFaceLabError(requestError.message || copy.faceLab.errorLoad);
    } finally {
      setFaceLabLoading(false);
    }
  };

  const handleFaceLabPresetPreview = (presetId) => {
    const preset = getFaceLabTestPreset(presetId);

    if (!preset?.result) {
      setFaceLabError(copy.faceLab.errorLoad);
      return;
    }

    setMode("face-lab");
    setFaceLabError("");
    setFaceLabResult(preset.result);
    setShowTestMenu(false);
  };

  const handleSkinPresetPreview = (presetId) => {
    const preset = getTestResultPreset(presetId);

    if (!preset) {
      return;
    }

    clearWriteAccessToken();
    sessionStorage.setItem("skinTestSubmission", JSON.stringify(preset.submission));
    sessionStorage.setItem("skinTestResult", JSON.stringify(preset.result));
    setShowTestMenu(false);
    router.push(locale === "en" ? "/en/result" : "/result");
  };

  const renderStep = () => {
    if (mode === "face-lab") {
      return (
        <FaceLab
          locale={locale}
          copy={copy}
          imageFile={imageFile}
          previewUrl={previewUrl}
          onImageChange={handleImageChange}
          onClearImage={clearImage}
          presets={FACE_LAB_TEST_PRESETS}
          onPresetPreview={handleFaceLabPresetPreview}
          faceLabResult={faceLabResult}
          faceLabError={faceLabError}
          faceLabLoading={faceLabLoading}
          onAnalyze={handleFaceLabAnalyze}
        />
      );
    }

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

  const showProgress = mode === "skin" && currentStep !== "photo";
  const showBottomCta = mode === "skin" && currentStep !== "loading";
  const showFaceLabBottomCta = mode === "face-lab" && !faceLabResult;

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
            {mode !== "face-lab" ? (
              <button
                type="button"
                onClick={() => setShowTestMenu((current) => !current)}
                className="ui-button-secondary-soft px-3 py-1.5 text-xs font-medium"
              >
                {copy.topActions.test}
              </button>
            ) : null}
            <button
              type="button"
              onClick={mode === "face-lab" ? handleOpenSkin : handleOpenFaceLab}
              className="ui-button-secondary-soft px-3 py-1.5 text-xs font-medium"
            >
              {mode === "face-lab" ? copy.topActions.skinMatch : copy.topActions.faceLab}
            </button>

            {mode !== "face-lab" && showTestMenu ? (
              <div className="ui-popover absolute right-0 top-11 z-20 w-[280px] p-3">
                <div className="space-y-3">
                  <div>
                    <p className="ui-kicker px-1">
                      Skin Match
                    </p>
                    <div className="mt-2 space-y-2">
                      {TEST_RESULT_PRESETS.map((preset) => (
                        <button
                          key={`skin-preset-${preset.id}`}
                          type="button"
                          onClick={() => handleSkinPresetPreview(preset.id)}
                          className="ui-button-secondary-muted w-full rounded-2xl px-3 py-3 text-left text-sm font-medium"
                        >
                          {copy.skinPresetLabels?.[preset.id] || preset.summaryLabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="ui-kicker px-1">
                      Face Lab
                    </p>
                    <div className="mt-2 space-y-2">
                      {FACE_LAB_TEST_PRESETS.map((preset) => (
                        <button
                          key={`face-preset-${preset.id}`}
                          type="button"
                          onClick={() => handleFaceLabPresetPreview(preset.id)}
                          className="ui-button-secondary-muted w-full rounded-2xl px-3 py-3 text-left text-sm font-medium"
                        >
                          {copy.facePresetLabels?.[preset.id] || preset.buttonLabel}
                        </button>
                      ))}
                    </div>
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

        <div key={`${mode}-${currentStep}`} className="step-enter flex flex-1 flex-col">
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

      {showFaceLabBottomCta ? (
        <BottomCTA
          primaryLabel={copy.faceLabButton}
          onPrimary={handleFaceLabAnalyze}
          primaryDisabled={!imageFile || faceLabLoading}
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
