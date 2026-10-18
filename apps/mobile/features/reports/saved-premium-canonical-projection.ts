// Read-only S4 projection of the same saved canonical sections used by web Full Report.
// Never recompute policy, compare numeric scores, infer new advice or overwrite saved data.
export type PremiumCanonicalSection = Readonly<{
  canonicalPresent: boolean;
  lines: readonly string[];
}>;

export type PremiumCanonicalSections = Readonly<{
  routine: PremiumCanonicalSection;
  functional: PremiumCanonicalSection;
  condition: PremiumCanonicalSection;
}>;

type Locale = "ko" | "en";

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, maximum = 360): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maximum) : null;
}

function uniqueBounded(lines: Array<string | null>, max = 12): string[] {
  return [...new Set(lines.filter((line): line is string => Boolean(line)))].slice(0, max);
}

function plan(report: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const direct = object(report[key]);
  if (direct) return direct;
  return object(object(report.decisionBundle)?.[key]);
}

function projectRoutine(source: Record<string, unknown> | null, locale: Locale): PremiumCanonicalSection {
  if (!source) return { canonicalPresent: false, lines: [] };
  const lines: Array<string | null> = [];
  for (const [key, label] of [
    ["morningSteps", locale === "en" ? "Morning" : "아침"],
    ["nightSteps", locale === "en" ? "Evening" : "저녁"]
  ] as const) {
    const steps = source[key];
    if (!Array.isArray(steps)) continue;
    for (const item of steps.slice(0, 6)) {
      const step = object(item);
      if (!step) continue;
      const title = text(step.title, 100);
      const action = text(step.action, 300);
      if (!title || !action) continue;
      const status = text(step.status, 55);
      const adjustment = text(step.adjustment, 200);
      const prefix = [label, title, status].filter(Boolean).join(" · ");
      lines.push(`${prefix}: ${action}${adjustment ? ` (${adjustment})` : ""}`);
    }
  }
  return { canonicalPresent: true, lines: uniqueBounded(lines) };
}

function projectFunctional(source: Record<string, unknown> | null, locale: Locale): PremiumCanonicalSection {
  if (!source) return { canonicalPresent: false, lines: [] };
  const labels = locale === "en"
    ? ["Priority", "Plan", "Direction", "Why", "Base routine"]
    : ["우선 고민", "실행 계획", "판단 방향", "판단 근거", "기본 루틴"];
  const keys = ["primaryConcern", "planSummary", "direction", "whyPriority", "baseApproach"];
  const lines = keys.map((key, i) => {
    const value = text(source[key]);
    return value ? `${labels[i]} · ${value}` : null;
  });
  // Preserve a declared HOLD/START state; never infer it from other fields.
  const planMode = text(source.planMode, 30);
  if (planMode && ["HOLD", "START"].includes(planMode)) {
    lines.unshift(`${locale === "en" ? "Plan status" : "실행 상태"} · ${planMode}`);
  }
  return { canonicalPresent: true, lines: uniqueBounded(lines, 8) };
}

function projectCondition(source: Record<string, unknown> | null, locale: Locale): PremiumCanonicalSection {
  if (!source) return { canonicalPresent: false, lines: [] };
  const allowed = {
    maintain: locale === "en" ? "Keep" : "유지",
    reduce: locale === "en" ? "Reduce" : "강도 줄이기",
    avoid_for_now: locale === "en" ? "Hold expansion" : "확장 보류"
  } as const;
  const lines: Array<string | null> = [];
  if (Array.isArray(source.responses)) {
    for (const raw of source.responses.slice(0, 5)) {
      const response = object(raw);
      if (!response) continue;
      const status = text(response.status);
      if (!status || !Object.prototype.hasOwnProperty.call(allowed, status)) continue;
      const title = text(response.title, 100);
      const summary = text(response.summary);
      if (!title || !summary) continue;
      const caption = allowed[status as keyof typeof allowed];
      const action = text(response.action);
      const reasons = Array.isArray(response.reasons)
        ? response.reasons.slice(0, 2).map((value) => text(value, 150)).filter(Boolean)
        : [];
      lines.push(`${caption} · ${title}: ${summary}`);
      if (reasons.length) lines.push(`${locale === "en" ? "Why" : "근거"} · ${reasons.join(" / ")}`);
      if (action) lines.push(`${locale === "en" ? "Temporary adjustment" : "임시 조정"} · ${action}`);
    }
  }
  const globalNotice = text(source.globalNotice);
  if (globalNotice) lines.push(`${locale === "en" ? "Notice" : "주의"} · ${globalNotice}`);
  return { canonicalPresent: true, lines: uniqueBounded(lines, 16) };
}

export function projectSavedPremiumCanonicalSections(reportValue: unknown, locale: Locale): PremiumCanonicalSections {
  const report = object(reportValue) || {};
  return {
    routine: projectRoutine(plan(report, "routinePlan"), locale),
    functional: projectFunctional(plan(report, "functionalPlan"), locale),
    condition: projectCondition(plan(report, "conditionPlan"), locale)
  };
}
