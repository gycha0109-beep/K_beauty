// Presentation-only helpers. Never derive new instructions or decision states from locale.
export function reportDisplayText(value, locale = "en") {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  // Prefer an explicit localized equivalent. If absent, show the source language.
  for (const key of [locale, "text", "body", locale === "en" ? "ko" : "en"]) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key];
  }
  return "";
}

export function preserveReportNarrative(report, locale = "en") {
  if (!report || typeof report !== "object" || Array.isArray(report)) return report;
  const fullRoutine = report.fullRoutine && typeof report.fullRoutine === "object"
    ? report.fullRoutine
    : {};
  return {
    ...report,
    topPickDetailedReason: reportDisplayText(report.topPickDetailedReason, locale),
    fullRoutine: {
      ...fullRoutine,
      morning: Array.isArray(fullRoutine.morning) ? fullRoutine.morning : [],
      night: Array.isArray(fullRoutine.night) ? fullRoutine.night : []
    },
    routineVariants: Array.isArray(report.routineVariants) ? report.routineVariants : [],
    avoidCombinations: Array.isArray(report.avoidCombinations) ? report.avoidCombinations : []
  };
}

export function preserveReportRoutineSteps(
  steps = [],
  fallbackItems = [],
  slot = "morning",
  locale = "en",
  productRoleLabel = () => ""
) {
  const input = Array.isArray(steps) && steps.length
    ? steps
    : (Array.isArray(fallbackItems) ? fallbackItems : []).map((instruction, index) => ({
        order: index + 1,
        instruction
      }));

  return input.map((raw, index) => {
    const step = raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw
      : { instruction: raw };
    const order = Number(step.order);
    const productRole = step.product
      ? productRoleLabel(step.product, locale)
      : reportDisplayText(step.productRole, locale);

    return {
      ...step,
      order: Number.isFinite(order) && order > 0 ? order : index + 1,
      stepName: reportDisplayText(step.stepName, locale).trim()
        || `${slot === "morning" ? "Morning" : "Night"} Step ${index + 1}`,
      productRole: productRole || "",
      // Source instructions, cautions and cadence MUST survive a language change.
      instruction: reportDisplayText(step.instruction, locale),
      frequency: reportDisplayText(step.frequency, locale),
      caution: reportDisplayText(step.caution, locale)
    };
  });
}
