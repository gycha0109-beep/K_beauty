from pathlib import Path

p = Path(__file__).resolve().parents[1] / "lib/premium-condition-projection.js"
s = p.read_text(encoding="utf-8")
old = '''function mergeLegacyFallback(report, responses) {
  const legacy = Array.isArray(report?.conditionResponses) ? report.conditionResponses : [];
  if (!legacy.length) return responses;

  const canonicalKeys = new Set(responses.map((item) => item.responseKey));
  const carryover = legacy
    .filter((item) => item?.responseKey && !canonicalKeys.has(item.responseKey))
    .map((item) => ({ ...item, source: "legacy_snapshot", legacyCarryover: true }));
  return [...responses, ...carryover];
}
'''
new = '''function mergeLegacyFallback(report, responses, conditionPolicy) {
  const legacy = Array.isArray(report?.conditionResponses) ? report.conditionResponses : [];
  if (!legacy.length) return responses;

  if (conditionPolicy?.conditionSignalState?.completeness !== "minimal") {
    return responses;
  }

  const legacySnapshot = legacy
    .filter((item) => item?.responseKey)
    .map((item) => ({ ...item, source: "legacy_snapshot", legacyCarryover: true }));
  const legacyKeys = new Set(legacySnapshot.map((item) => item.responseKey));
  return [...legacySnapshot, ...responses.filter((item) => !legacyKeys.has(item.responseKey))];
}
'''
if s.count(old) != 1:
    raise RuntimeError(f"legacy projection match count {s.count(old)}")
s = s.replace(old, new, 1)
s = s.replace('const responses = mergeLegacyFallback(report, fallback).slice(0, 5);', 'const responses = mergeLegacyFallback(report, fallback, conditionPolicy).slice(0, 5);', 1)
p.write_text(s, encoding="utf-8")
