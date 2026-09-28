const OILY_TYPE_PATTERNS = Object.freeze([
  /\boily\s+skin\b/iu,
  /지성\s*피부/u,
  /기름지는\s*피부/u,
  /피부가\s*기름지(?:는|다|고|게|는\s*편|ㄴ)/u
]);

const OILINESS_CONCERN_PATTERNS = Object.freeze([
  /(?:유분|피지|번들거림|기름기).{0,16}(?:고민|문제|줄|잡|조절|관리|싫|과다|많)/u,
  /(?:고민|문제|줄이|잡고|조절|관리).{0,16}(?:유분|피지|번들거림|기름기)/u,
  /\b(?:oiliness|sebum|shine)\b.{0,24}\b(?:concern|problem|control|reduce|less)\b/iu,
  /\b(?:concern|problem|control|reduce|less)\b.{0,24}\b(?:oiliness|sebum|shine)\b/iu
]);

const WHITE_CAST_AVOIDANCE_PATTERNS = Object.freeze([
  /(?:백탁|white\s*cast).{0,18}(?:싫|없|적|피하|원치|원하지|avoid|hate|no|low|less)/iu,
  /(?:싫|없|적|피하|원치|원하지|avoid|hate|no|low|less).{0,18}(?:백탁|white\s*cast)/iu
]);

const TONE_UP_NEGATIVE_PATTERNS = Object.freeze([
  /(?:톤\s*업|tone[\s-]*up).{0,18}(?:싫|원치|원하지|피하|안\s*원|없었으면|hate|avoid|don't\s+want|do\s+not\s+want)/iu,
  /(?:싫|원치|원하지|피하|안\s*원|hate|avoid|don't\s+want|do\s+not\s+want).{0,18}(?:톤\s*업|tone[\s-]*up)/iu
]);

const TONE_UP_POSITIVE_PATTERNS = Object.freeze([
  /(?:얼굴|피부|안색).{0,18}(?:밝아|밝게|화사)/u,
  /(?:밝아|밝게|화사).{0,18}(?:원|좋|싶|됐으면|되었으면)/u,
  /(?:톤\s*업|tone[\s-]*up).{0,18}(?:원|좋|선호|want|prefer)/iu,
  /(?:확실하게|확실히|제대로|분명하게).{0,12}(?:톤\s*업|tone[\s-]*up)(?:되|되는|효과)/iu,
  /(?:톤\s*업|tone[\s-]*up)(?:되는|효과).{0,18}(?:찾|추천|원|좋|want|prefer)/iu,
  /\b(?:brighter|brightening)\b.{0,18}\b(?:face|skin|complexion)\b/iu
]);

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function appendUnique(values, item) {
  if (!Array.isArray(values)) return values;
  return values.includes(item) ? [...values] : [...values, item];
}

function isToneUpConflictTerm(value) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();

  const referencesToneUp =
    normalized.includes("tone up") ||
    normalized.includes("toneup") ||
    normalized.includes("톤업") ||
    normalized.includes("톤 업");
  const referencesConflict =
    normalized.includes("conflict") ||
    normalized.includes("contradict") ||
    normalized.includes("충돌") ||
    normalized.includes("상충") ||
    normalized.includes("모순");

  return referencesToneUp && referencesConflict;
}

function removeToneUpConflictTerms(values) {
  if (!Array.isArray(values)) return values;
  return values.filter((item) => !isToneUpConflictTerm(item));
}

export function canonicalizeProductQuerySemanticOwnership(query, candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return candidate;
  }

  const normalizedQuery = typeof query === "string"
    ? query.normalize("NFKC").replace(/\s+/g, " ").trim()
    : "";

  const next = {
    ...candidate,
    concerns: Array.isArray(candidate.concerns) ? [...candidate.concerns] : candidate.concerns,
    unresolved_terms: Array.isArray(candidate.unresolved_terms)
      ? [...candidate.unresolved_terms]
      : candidate.unresolved_terms
  };

  const hasOilyType = matchesAny(normalizedQuery, OILY_TYPE_PATTERNS);
  const hasSeparateOilinessConcern = matchesAny(normalizedQuery, OILINESS_CONCERN_PATTERNS);
  if (hasOilyType) {
    next.skin_type = "oily";
    if (Array.isArray(next.concerns) && !hasSeparateOilinessConcern) {
      next.concerns = next.concerns.filter((concern) => concern !== "oiliness");
    }
  }

  const hasWhiteCastAvoidance = matchesAny(
    normalizedQuery,
    WHITE_CAST_AVOIDANCE_PATTERNS
  );
  const hasToneUpNegative = matchesAny(normalizedQuery, TONE_UP_NEGATIVE_PATTERNS);
  const hasToneUpPositive = matchesAny(normalizedQuery, TONE_UP_POSITIVE_PATTERNS);
  const hasToneUpConflict = hasToneUpNegative && hasToneUpPositive;

  if (hasWhiteCastAvoidance) {
    next.white_cast_hate = true;
  }

  if (hasToneUpConflict) {
    next.tone_up_wanted = null;
    next.unresolved_terms = appendUnique(
      removeToneUpConflictTerms(next.unresolved_terms),
      "tone-up preference conflict"
    );
    next.confidence = "low";
  } else {
    next.unresolved_terms = removeToneUpConflictTerms(next.unresolved_terms);

    if (hasToneUpPositive) {
      next.tone_up_wanted = true;
    } else if (hasToneUpNegative) {
      next.tone_up_wanted = false;
    } else if (hasWhiteCastAvoidance) {
      // White-cast avoidance does not imply a tone-up preference.
      next.tone_up_wanted = null;
    }
  }

  return next;
}
