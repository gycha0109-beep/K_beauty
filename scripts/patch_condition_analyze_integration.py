from pathlib import Path

p = Path(__file__).resolve().parents[1] / "app/api/analyze/route.js"
s = p.read_text(encoding="utf-8")

def once(old, new):
    global s
    if s.count(old) != 1:
        raise RuntimeError(f"analyze match count {s.count(old)} for {old[:70]!r}")
    s = s.replace(old, new, 1)

once('import { buildSkinMatchDecisionBundle } from "@/lib/skin-match-decision-engine";\n', 'import { buildSkinMatchDecisionBundle } from "@/lib/skin-match-decision-engine";\nimport { rebuildPremiumDecisionState } from "@/lib/premium-decision-state";\n')

marker = 'function sanitizePremiumReport(report) {'
helper = '''function sanitizeCanonicalDecisionArtifact(value, depth = 0) {
  if (depth > 12 || value == null) return value == null ? null : undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.slice(0, 1000);
  if (Array.isArray(value)) {
    return value.slice(0, 60)
      .map((item) => sanitizeCanonicalDecisionArtifact(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof value !== "object") return undefined;
  return Object.fromEntries(
    Object.entries(value).slice(0, 120)
      .map(([key, item]) => [String(key).slice(0, 120), sanitizeCanonicalDecisionArtifact(item, depth + 1)])
      .filter(([, item]) => item !== undefined)
  );
}

function sanitizePremiumReport(report) {'''
once(marker, helper)
once('    conditionResponses: sanitizeConditionResponsesForPremium(report.conditionResponses),\n', '    conditionResponses: sanitizeConditionResponsesForPremium(report.conditionResponses),\n    conditionPolicy: sanitizeCanonicalDecisionArtifact(report.conditionPolicy),\n    conditionPlan: sanitizeCanonicalDecisionArtifact(report.conditionPlan),\n    decisionBundle: sanitizeCanonicalDecisionArtifact(report.decisionBundle),\n    routinePolicy: sanitizeCanonicalDecisionArtifact(report.routinePolicy),\n    routinePlan: sanitizeCanonicalDecisionArtifact(report.routinePlan),\n    functionalPolicy: sanitizeCanonicalDecisionArtifact(report.functionalPolicy),\n    functionalPlan: sanitizeCanonicalDecisionArtifact(report.functionalPlan),\n')
old = '''    const premiumReport = sanitizePremiumReport(decision.premiumReport);
    const premiumSessionReport = premiumReport
      ? {
          ...premiumReport,
          freeResult: publicDecision
        }
      : null;
'''
new = '''    const premiumDecisionSource = decision.premiumReport
      ? {
          ...decision.premiumReport,
          freeResult: publicDecision
        }
      : null;
    const premiumSessionReport = premiumDecisionSource
      ? sanitizePremiumReport(rebuildPremiumDecisionState(premiumDecisionSource, {
          locale,
          source: "api_analyze_initial_session"
        }))
      : null;
'''
once(old, new)
p.write_text(s, encoding="utf-8")
