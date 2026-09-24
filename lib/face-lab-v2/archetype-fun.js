import { FACE_LAB_ARCHETYPE_REGISTRY } from "../face-lab-archetype-registry.js";
import { scoreFaceLabArchetypes } from "../face-lab-archetype-scoring.js";

export const ARCHETYPE_FUN_VERSION = "face-lab-archetype-fun-v1";

function labelFor(key, locale) {
  const item = FACE_LAB_ARCHETYPE_REGISTRY.archetypes.find(
    (candidate) => candidate.key === key
  );
  if (!item) return key;
  return locale === "en" ? item.label.en : item.label.ko;
}

export function buildArchetypeFunProjection(analysis, { locale = "ko" } = {}) {
  let scoring;

  try {
    scoring = scoreFaceLabArchetypes(analysis);
  } catch {
    return {
      status: "unavailable",
      version: ARCHETYPE_FUN_VERSION,
      funOnly: true,
      styleAuthority: false,
      primary: null,
      secondary: null,
      mix: [],
      evidence: [],
      unavailableReason: "archetype_fun_scoring_unavailable"
    };
  }

  const ranked = scoring.candidates
    .filter((candidate) => candidate.rawScore > 0)
    .slice(0, 2);

  if (!scoring.analysisUsable || !ranked.length) {
    return {
      status: "insufficient_evidence",
      version: ARCHETYPE_FUN_VERSION,
      funOnly: true,
      styleAuthority: false,
      primary: null,
      secondary: null,
      mix: [],
      evidence: [],
      unavailableReason: "archetype_fun_evidence_insufficient"
    };
  }

  const positiveTotal = ranked.reduce(
    (sum, candidate) => sum + Math.max(0, candidate.rawScore),
    0
  );

  const mix = ranked.map((candidate) => ({
    key: candidate.key,
    label: labelFor(candidate.key, locale),
    relativeShare: positiveTotal > 0
      ? Number((candidate.rawScore / positiveTotal).toFixed(3))
      : null,
    evidenceCoverage: candidate.evidenceCoverage
  }));

  return {
    status: "available",
    version: ARCHETYPE_FUN_VERSION,
    funOnly: true,
    styleAuthority: false,
    primary: mix[0] || null,
    secondary: mix[1] || null,
    mix,
    evidence: [
      `registry:${scoring.registryVersion}`,
      "source:face_lab_observation_analysis"
    ],
    disclaimer: locale === "en"
      ? "A lightweight, shareable archetype mix for fun. It does not drive your styling routes."
      : "재미와 공유를 위한 가벼운 아키타입 믹스이며, 스타일 경로를 결정하는 근거로 사용하지 않습니다.",
    unavailableReason: null
  };
}
