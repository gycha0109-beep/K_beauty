from pathlib import Path

p = Path(__file__).resolve().parents[1] / "lib/premium-report-reentry.js"
s = p.read_text(encoding="utf-8")
old = '''      ...basePremiumReport,
      currentProducts: null,
      currentProductVerdicts: []
'''
new = '''      ...basePremiumReport,
      currentProducts: null,
      currentProductVerdicts: [],
      conditionResponses: []
'''
if s.count(old) != 1:
    raise RuntimeError(f"reentry patch match count {s.count(old)}")
s = s.replace(old, new, 1)
p.write_text(s, encoding="utf-8")
