export const TARGET_STYLE_REGISTRY_VERSION = "target-style-registry-v1";

export const TARGET_STYLE_AXES = [
  "softSharp",
  "naturalPolished",
  "playfulMature",
  "minimalStatement",
  "warmCool",
  "classicTrendy"
];

function range(min, max) {
  return [min, max];
}

export const TARGET_STYLE_REGISTRY = {
  natural: {
    labels: { ko: "내추럴", en: "Natural" },
    vectorRanges: {
      softSharp: range(0.30, 0.55),
      naturalPolished: range(0.10, 0.35),
      playfulMature: range(0.35, 0.60),
      minimalStatement: range(0.10, 0.35),
      warmCool: range(0.35, 0.65),
      classicTrendy: range(0.35, 0.60)
    }
  },
  clear_soft: {
    labels: { ko: "맑고 청순한", en: "Clear & Soft" },
    vectorRanges: {
      softSharp: range(0.15, 0.35),
      naturalPolished: range(0.35, 0.60),
      playfulMature: range(0.25, 0.50),
      minimalStatement: range(0.15, 0.40),
      warmCool: range(0.35, 0.65),
      classicTrendy: range(0.35, 0.60)
    }
  },
  soft: {
    labels: { ko: "부드러운", en: "Soft" },
    vectorRanges: {
      softSharp: range(0.10, 0.30),
      naturalPolished: range(0.30, 0.60),
      playfulMature: range(0.35, 0.60),
      minimalStatement: range(0.20, 0.45),
      warmCool: range(0.35, 0.65),
      classicTrendy: range(0.35, 0.60)
    }
  },
  cute_playful: {
    labels: { ko: "귀엽고 발랄한", en: "Cute & Playful" },
    vectorRanges: {
      softSharp: range(0.15, 0.40),
      naturalPolished: range(0.25, 0.55),
      playfulMature: range(0.10, 0.30),
      minimalStatement: range(0.30, 0.60),
      warmCool: range(0.35, 0.70),
      classicTrendy: range(0.45, 0.75)
    }
  },
  sophisticated: {
    labels: { ko: "세련된", en: "Sophisticated" },
    vectorRanges: {
      softSharp: range(0.50, 0.72),
      naturalPolished: range(0.72, 0.92),
      playfulMature: range(0.58, 0.82),
      minimalStatement: range(0.30, 0.60),
      warmCool: range(0.40, 0.70),
      classicTrendy: range(0.45, 0.70)
    }
  },
  chic: {
    labels: { ko: "시크한", en: "Chic" },
    vectorRanges: {
      softSharp: range(0.68, 0.90),
      naturalPolished: range(0.65, 0.88),
      playfulMature: range(0.62, 0.85),
      minimalStatement: range(0.45, 0.72),
      warmCool: range(0.55, 0.82),
      classicTrendy: range(0.45, 0.75)
    }
  },
  mature_calm: {
    labels: { ko: "성숙하고 차분한", en: "Mature & Calm" },
    vectorRanges: {
      softSharp: range(0.38, 0.65),
      naturalPolished: range(0.58, 0.82),
      playfulMature: range(0.72, 0.92),
      minimalStatement: range(0.20, 0.50),
      warmCool: range(0.35, 0.70),
      classicTrendy: range(0.30, 0.58)
    }
  },
  defined: {
    labels: { ko: "또렷한", en: "Defined" },
    vectorRanges: {
      softSharp: range(0.65, 0.90),
      naturalPolished: range(0.55, 0.82),
      playfulMature: range(0.45, 0.75),
      minimalStatement: range(0.48, 0.78),
      warmCool: range(0.35, 0.70),
      classicTrendy: range(0.40, 0.68)
    }
  },
  minimal: {
    labels: { ko: "미니멀", en: "Minimal" },
    vectorRanges: {
      softSharp: range(0.38, 0.62),
      naturalPolished: range(0.55, 0.80),
      playfulMature: range(0.48, 0.75),
      minimalStatement: range(0.05, 0.25),
      warmCool: range(0.38, 0.65),
      classicTrendy: range(0.25, 0.52)
    }
  },
  statement_glam: {
    labels: { ko: "화려한", en: "Statement / Glam" },
    vectorRanges: {
      softSharp: range(0.45, 0.75),
      naturalPolished: range(0.65, 0.90),
      playfulMature: range(0.35, 0.70),
      minimalStatement: range(0.78, 0.95),
      warmCool: range(0.30, 0.75),
      classicTrendy: range(0.55, 0.88)
    }
  },
  classic: {
    labels: { ko: "클래식", en: "Classic" },
    vectorRanges: {
      softSharp: range(0.40, 0.65),
      naturalPolished: range(0.65, 0.88),
      playfulMature: range(0.58, 0.82),
      minimalStatement: range(0.25, 0.55),
      warmCool: range(0.35, 0.68),
      classicTrendy: range(0.05, 0.25)
    }
  },
  trendy: {
    labels: { ko: "트렌디", en: "Trendy" },
    vectorRanges: {
      softSharp: range(0.40, 0.75),
      naturalPolished: range(0.50, 0.82),
      playfulMature: range(0.25, 0.65),
      minimalStatement: range(0.45, 0.80),
      warmCool: range(0.30, 0.75),
      classicTrendy: range(0.78, 0.95)
    }
  }
};

export function getTargetStylePrototype(key) {
  const entry = TARGET_STYLE_REGISTRY[key];
  if (!entry) return null;

  return Object.fromEntries(
    TARGET_STYLE_AXES.map((axis) => {
      const value = entry.vectorRanges[axis];
      return [axis, Number(((value[0] + value[1]) / 2).toFixed(3))];
    })
  );
}

export function getTargetStyleLabel(key, locale = "ko") {
  const entry = TARGET_STYLE_REGISTRY[key];
  if (!entry) return null;
  return entry.labels[locale === "en" ? "en" : "ko"];
}

export function isTargetStyleKey(value) {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TARGET_STYLE_REGISTRY, value);
}
