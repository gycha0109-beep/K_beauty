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

export const PHOTO_OBSERVATION_KEYS = [
  "oiliness",
  "dehydration",
  "acne",
  "uneven_tone",
  "pores",
  "redness",
  "barrier"
];

const PHOTO_OBSERVATION_CONFIDENCE = ["low", "medium", "high"];
const PHOTO_ALIGNMENT_STATUSES = ["aligned", "mixed", "conflict", "unknown"];

function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function getObservationLabel(key, locale = "ko") {
  const labels = locale === "en"
    ? {
        oiliness: "Oil expression",
        dehydration: "Lower hydration look",
        acne: "Breakout tendency",
        uneven_tone: "Uneven tone",
        pores: "Visible pores",
        redness: "Redness",
        barrier: "Barrier stress"
      }
    : {
        oiliness: "유분 표현",
        dehydration: "수분감 저하",
        acne: "트러블 경향",
        uneven_tone: "톤 불균일",
        pores: "모공 표현",
        redness: "붉은기",
        barrier: "장벽 부담"
      };

  return labels[key] || (locale === "en" ? "Photo cue" : "사진 단서");
}

export function buildFallbackPhotoObservations(locale = "ko") {
  return {
    summary: locale === "en"
      ? "The photo did not provide enough reliable detail, so the result is organized mainly around the survey answers."
      : "사진 상태를 기준으로 세부 관찰을 확정하기 어려워, 설문 답변을 중심으로 결과를 정리했습니다.",
    signals: [],
    surveyAlignment: {
      status: "unknown",
      note: locale === "en"
        ? "Photo analysis was limited, so the survey answers were prioritized."
        : "사진 분석이 제한되어 설문 답변을 우선 반영했습니다."
    }
  };
}

export function createPhotoEvidencePrompt(locale = "ko", surveyContext = null) {
  const isEnglish = locale === "en";
  const surveyBlock = surveyContext
    ? `\nSurvey context for alignment:\n${JSON.stringify(surveyContext, null, 2)}\n`
    : "\nSurvey context is not available. Use surveyAlignment.status = \"unknown\".\n";

  return `
You are extracting visible skin evidence from a single face photo for a deterministic skincare engine.
Return only valid JSON.
Do not use markdown.
Do not recommend products.
Do not mention brand names.
Do not diagnose disease.
If the image is unclear, lower the scores instead of guessing.
${isEnglish ? "Use English." : "Use Korean."}
${surveyBlock}

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
  ],
  "photoObservations": {
    "summary": "${isEnglish ? "One cautious sentence summarizing 2-3 visible tendencies from the photo." : "사진 기준으로 보이는 피부 경향 2~3개를 조심스럽게 요약한 한 문장"}",
    "signals": [
      {
        "key": "dehydration",
        "label": "${isEnglish ? "Lower hydration look" : "수분감 저하"}",
        "area": "${isEnglish ? "cheeks / jawline" : "볼/턱 라인"}",
        "confidence": "medium",
        "description": "${isEnglish ? "The cheek and jawline area appears relatively dry in the photo." : "볼과 턱 라인 쪽이 상대적으로 건조해 보입니다."}"
      }
    ],
    "surveyAlignment": {
      "status": "aligned",
      "note": "${isEnglish ? "The survey concern and the photo tendency mostly point in a similar direction." : "설문에서 선택한 고민과 사진에서 보이는 경향이 대체로 비슷합니다."}"
    }
  }
}

Rules:
- Every signal must be an integer from 0 to 5.
- Use only what is visually plausible from the photo.
- Keep evidence to at most 4 items.
- photoObservations.signals must contain only 2-3 items.
- photoObservations.signals[].key must be one of: oiliness, dehydration, acne, uneven_tone, pores, redness, barrier.
- photoObservations.signals[].confidence must be one of: low, medium, high.
- If lighting, makeup, blur, angle, or image quality lowers certainty, set confidence to low.
- Never diagnose medical conditions, skin disease, or acne as a disease. Use cautious wording only.
- Use cautious wording such as ${isEnglish ? "\"appears\", \"tends to look\", or \"may be visible\"" : "\"보입니다\", \"경향이 있습니다\", 또는 \"가능성이 있습니다\""}.
- surveyAlignment.status must be aligned, mixed, conflict, or unknown.
- surveyAlignment should compare the survey context with the photo tendency when survey context is available.
- Avoid exaggerated skin judgments or definitive claims.
- Evidence should describe visible cues such as shine, visible redness, active spots, pore visibility, uneven tone, dryness, or sun-exposed look.
- UV is allowed only as a weak visible cue score unless the sun-exposed look is clearly visible.
- If makeup, blur, or styling reduces certainty, stay conservative.
`.trim();
}

function normalizeAxis(value) {
  return PHOTO_EVIDENCE_AXES.includes(value) ? value : null;
}

function normalizeObservationKey(value) {
  return PHOTO_OBSERVATION_KEYS.includes(value) ? value : null;
}

function normalizeConfidence(value) {
  return PHOTO_OBSERVATION_CONFIDENCE.includes(value) ? value : "low";
}

function normalizeAlignmentStatus(value) {
  return PHOTO_ALIGNMENT_STATUSES.includes(value) ? value : "unknown";
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
    ],
    photoObservations: buildFallbackPhotoObservations(locale)
  };
}

export function normalizePhotoObservations(parsed, locale = "ko") {
  const fallback = buildFallbackPhotoObservations(locale);
  const source = parsed?.photoObservations && typeof parsed.photoObservations === "object"
    ? parsed.photoObservations
    : null;

  if (!source) {
    return fallback;
  }

  const signals = Array.isArray(source.signals)
    ? source.signals
        .map((item) => {
          const key = normalizeObservationKey(item?.key);

          if (!key) {
            return null;
          }

          return {
            key,
            label: cleanText(item?.label) || getObservationLabel(key, locale),
            area: cleanText(item?.area),
            confidence: normalizeConfidence(item?.confidence),
            description: cleanText(item?.description)
          };
        })
        .filter((item) => item && (item.label || item.area || item.description))
        .slice(0, 3)
    : [];
  const summary = cleanText(source.summary) || (signals.length
    ? signals
        .map((item) => item.description)
        .filter(Boolean)
        .slice(0, 2)
        .join(locale === "en" ? " " : " ")
    : fallback.summary);
  const alignment = source.surveyAlignment && typeof source.surveyAlignment === "object"
    ? {
        status: normalizeAlignmentStatus(source.surveyAlignment.status),
        note: cleanText(source.surveyAlignment.note) || fallback.surveyAlignment.note
      }
    : fallback.surveyAlignment;

  return {
    summary,
    signals,
    surveyAlignment: alignment
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
    evidence: evidence.length ? evidence : fallback.evidence,
    photoObservations: normalizePhotoObservations(parsed, locale)
  };
}
