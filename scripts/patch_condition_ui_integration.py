from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def patch(path, replacements):
    p = ROOT / path
    s = p.read_text(encoding="utf-8")
    for old, new in replacements:
        count = s.count(old)
        if count != 1:
            raise RuntimeError(f"{path}: match count {count} for {old[:70]!r}")
        s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8")

patch("components/full-report/PremiumConditionResponseSection.jsx", [
    (
        'export default function PremiumConditionResponseSection({ responses = [], locale = "ko", onNavigate }) {\n  const copy = getCopy(locale);\n  const items = (Array.isArray(responses) ? responses : [])\n',
        'export default function PremiumConditionResponseSection({ conditionPlan = null, responses = [], locale = "ko", onNavigate }) {\n  const copy = getCopy(locale);\n  const canonicalResponses = Array.isArray(conditionPlan?.responses) ? conditionPlan.responses : null;\n  const source = canonicalResponses ? "canonical" : "legacy_adapter";\n  const items = (canonicalResponses || (Array.isArray(responses) ? responses : []))\n'
    ),
    (
        '    <section className="ui-card p-5 sm:p-6">',
        '    <section className="ui-card p-5 sm:p-6" data-condition-source={source}>'
    ),
    (
        '      <button\n',
        '      {conditionPlan?.globalNotice ? (\n        <p className="mt-4 rounded-[0.85rem] border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-200">\n          {conditionPlan.globalNotice}\n        </p>\n      ) : null}\n\n      <button\n'
    )
])

patch("app/result/full-report/page.js", [
    (
        '        <PremiumConditionResponseSection\n          responses={report?.conditionResponses}\n',
        '        <PremiumConditionResponseSection\n          conditionPlan={report?.conditionPlan || report?.decisionBundle?.conditionPlan}\n          responses={report?.conditionResponses}\n'
    )
])
