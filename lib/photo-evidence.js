export const PHOTO_EVIDENCE_AXES = [
  "barrier",
  "dehydration",
  "oiliness",
  "redness",
  "acne",
  "pores",
  "uneven_tone",
  "uv"
];

export function createPhotoEvidencePrompt(locale = "ko") {
  const isEnglish = locale === "en";

  return `
You are extracting visible skin evidence from a single face photo for a deterministic skincare engine.
Return only valid JSON.
Do not use markdown.
Do not recommend products.
Do not mention brand names.
Do not diagnose disease.
If the image is unclear, lower the scores instead of guessing.
${isEnglish ? "Use English." : "Use Korean."}

Required JSON shape:
{
  "signals": {
    "barrier": 0,
    "dehydration": 0,
    "oiliness": 0,
    "redness": 0,
    "acne": 0,
    "pores": 0,
    "uneven_tone": 0,
    "uv": 0
  },
  "evidence": [
    {
      "axis": "oiliness",
      "label": "${isEnglish ? "Short evidence label" : "짧은 근거 라벨"}",
      "detail": "${isEnglish ? "One short sentence grounded in what is visible." : "보이는 근거를 바탕으로 한 짧은 문장"}"
    }
  ]
}

Rules:
- Every signal must be an integer from 0 to 5.
- Use only what is visually plausible from the photo.
- Keep evidence to at most 4 items.
- Evidence should describe visible cues such as shine, visible redness, active spots, pore visibility, uneven tone, dryness, or sun-exposed look.
- UV is allowed only as a weak visible cue score unless the sun-exposed look is clearly visible.
- If makeup, blur, or styling reduces certainty, stay conservative.
`.trim();
}

function normalizeAxis(value) {
  return PHOTO_EVIDENCE_AXES.includes(value) ? value : null;
}

function normalizeSignalValue(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(parsed)));
}

export function buildFallbackPhotoAnalysis(locale = "ko") {
  const detail = locale === "en"
    ? "Visible skin cues were limited, so the survey carried more of the decision."
    : "사진에서 읽히는 피부 단서가 제한적이라 설문 가중치 비중을 더 높게 두었습니다.";

  return {
    signals: Object.fromEntries(PHOTO_EVIDENCE_AXES.map((axis) => [axis, 0])),
    evidence: [
      {
        axis: "barrier",
        label: locale === "en" ? "Limited photo certainty" : "사진 판독 한계",
        detail
      }
    ]
  };
}

export function normalizePhotoAnalysis(parsed, locale = "ko") {
  const fallback = buildFallbackPhotoAnalysis(locale);
  const signals = Object.fromEntries(
    PHOTO_EVIDENCE_AXES.map((axis) => [
      axis,
      normalizeSignalValue(parsed?.signals?.[axis])
    ])
  );

  const evidence = Array.isArray(parsed?.evidence)
    ? parsed.evidence
        .map((item) => ({
          axis: normalizeAxis(item?.axis) || "barrier",
          label: String(item?.label || "").trim(),
          detail: String(item?.detail || "").trim()
        }))
        .filter((item) => item.label || item.detail)
        .slice(0, 4)
    : [];

  return {
    signals,
    evidence: evidence.length ? evidence : fallback.evidence
  };
}
