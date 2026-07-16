from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def patch(path, replacements):
    p = ROOT / path
    s = p.read_text(encoding="utf-8")
    for old, new in replacements:
        count = s.count(old)
        if count != 1:
            raise RuntimeError(f"{path}: match count {count} for {old[:80]!r}")
        s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8")

patch("scripts/verify-routine-policy-single-source.mjs", [
    ('/shared-skin-decision-context-v2/', '/shared-skin-decision-context-v3/')
])

for verifier in [
    "scripts/verify-premium-decision-state.mjs",
    "scripts/verify-functional-policy-single-source.mjs"
]:
    patch(verifier, [('"premium-decision-bundle-v3"', '"premium-decision-bundle-v4"')])

p = ROOT / "scripts/verify-condition-policy-single-source.mjs"
s = p.read_text(encoding="utf-8")
needle = '''assert.equal(decisionState.decisionBundle.dependencies.routinePolicyResult, false);

const decisionSource = readFileSync(new URL("../lib/premium-decision-state.js", import.meta.url), "utf8");
'''
insert = '''assert.equal(decisionState.decisionBundle.dependencies.routinePolicyResult, false);
assert.equal(decisionState.decisionBundle.context.version, "shared-skin-decision-context-v3");
assert.equal(decisionState.decisionBundle.context.conditionSignalState.rednessOrIrritation, "yes");
assert.equal(decisionState.conditionPlan.source, "canonical");

const analyzeSource = readFileSync(new URL("../app/api/analyze/route.js", import.meta.url), "utf8");
assert.match(analyzeSource, /rebuildPremiumDecisionState\(premiumDecisionSource/);
assert.match(analyzeSource, /source: "api_analyze_initial_session"/);
for (const artifact of ["conditionPolicy", "conditionPlan", "decisionBundle"]) {
  assert.match(analyzeSource, new RegExp(`${artifact}: sanitizeCanonicalDecisionArtifact`));
}

const conditionComponentSource = readFileSync(
  new URL("../components/full-report/PremiumConditionResponseSection.jsx", import.meta.url),
  "utf8"
);
assert.match(conditionComponentSource, /Array\.isArray\(conditionPlan\?\.responses\)/);
assert.match(conditionComponentSource, /data-condition-source=\{source\}/);
assert.match(conditionComponentSource, /canonicalResponses \|\|/);

const fullReportPageSource = readFileSync(new URL("../app/result/full-report/page.js", import.meta.url), "utf8");
assert.match(fullReportPageSource, /conditionPlan=\{report\?\.conditionPlan \|\| report\?\.decisionBundle\?\.conditionPlan\}/);

const decisionSource = readFileSync(new URL("../lib/premium-decision-state.js", import.meta.url), "utf8");
'''
if s.count(needle) != 1:
    raise RuntimeError(f"condition verifier insertion match count {s.count(needle)}")
s = s.replace(needle, insert, 1)
p.write_text(s, encoding="utf-8")
