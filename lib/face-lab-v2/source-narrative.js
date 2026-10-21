// Read-only source evidence for bilingual review. Never include raw vision payloads,
// images, face geometry, model traces or arbitrary object fields in this projection.
export function collectFaceLabOriginalKoreanText(result, limit = 20) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return [];
  const values = [
    result.currentFaceProfile?.summary,
    ...(result.currentFaceProfile?.keyFeatures || []).flatMap((item) => [item?.label, item?.explanation]),
    result.styleDelta?.summary,
    ...(result.styleDelta?.preservedFeatures || []).map((item) => item?.reason),
    ...(result.routes?.routes || []).flatMap((route) => [
      route?.title, route?.summary, route?.whyThisRoute, route?.targetFit?.explanation
    ]),
    ...(result.looks?.looks || []).flatMap((look) => [
      look?.title, look?.summary, look?.whyItWorks,
      ...(look?.pieces || []).map((piece) => piece?.summary)
    ])
  ];
  return [...new Set(values.filter(
    (value) => typeof value === "string" && value.trim() && /[가-힣]/.test(value)
  ).map((value) => value.trim()))].slice(0, Math.max(0, Math.min(50, limit)));
}
