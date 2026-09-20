export const PREMIUM_INTAKE_VERSION = "premium-intake-v1";

export const PREMIUM_INTAKE_STEP_STATES = Object.freeze([
  "answered",
  "skipped",
  "unknown"
]);

export const PREMIUM_INTAKE_YES_NO_UNKNOWN = Object.freeze([
  "yes",
  "no",
  "unknown"
]);

export const PREMIUM_INTAKE_DECISION_FOCUS = Object.freeze([
  "current_product_fit",
  "routine_order",
  "functional_addition",
  "condition_response",
  "unknown"
]);

const STEP_KEYS = Object.freeze([
  "currentProducts",
  "usage",
  "recentContext",
  "decisionFocus"
]);

function normalizeEnum(value, values, fallback) {
  const normalized = String(value || "").trim();
  return values.includes(normalized) ? normalized : fallback;
}

function normalizeStepStates(input = {}) {
  return Object.fromEntries(
    STEP_KEYS.map((key) => [
      key,
      normalizeEnum(
        input?.[key],
        PREMIUM_INTAKE_STEP_STATES,
        "unknown"
      )
    ])
  );
}

export function sanitizePremiumIntake(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input
    : {};
  const answers = source?.answers && typeof source.answers === "object" && !Array.isArray(source.answers)
    ? source.answers
    : {};

  return {
    version: PREMIUM_INTAKE_VERSION,
    stepStates: normalizeStepStates(source.stepStates),
    answers: {
      recentlyChangedProduct: normalizeEnum(
        answers.recentlyChangedProduct,
        PREMIUM_INTAKE_YES_NO_UNKNOWN,
        "unknown"
      ),
      productReaction: normalizeEnum(
        answers.productReaction,
        PREMIUM_INTAKE_YES_NO_UNKNOWN,
        "unknown"
      )
    },
    decisionFocus: normalizeEnum(
      source.decisionFocus,
      PREMIUM_INTAKE_DECISION_FOCUS,
      "unknown"
    )
  };
}

export function hasPremiumIntakeSignal(input = {}) {
  const intake = sanitizePremiumIntake(input);

  return (
    Object.values(intake.stepStates).some((state) => state !== "unknown") ||
    Object.values(intake.answers).some((answer) => answer !== "unknown") ||
    intake.decisionFocus !== "unknown"
  );
}

export function buildPremiumIntakeSurveyAnswers(input = {}) {
  const intake = sanitizePremiumIntake(input);
  return {
    recentlyChangedProduct: intake.answers.recentlyChangedProduct,
    productReaction: intake.answers.productReaction
  };
}
