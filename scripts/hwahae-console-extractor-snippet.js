/*
  Hwahae visible-page extractor
  - Run this in the browser console on an already opened Hwahae product page.
  - It only reads document.body.innerText from the current page.
  - It does not log in, make network requests, or use Playwright.
  - Replace productId before saving the JSON.
*/

(async () => {
  const PRODUCT_ID_PLACEHOLDER = "USER_MUST_REPLACE_SUPABASE_PRODUCT_ID";
  const bodyText = document.body?.innerText || "";
  const lines = bodyText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const normalize = (value) =>
    String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const normalizeCompact = (value) =>
    normalize(value).replace(/[^a-z0-9가-힣]/g, "");

  const parseCount = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.round(value));
    }

    const digits = String(value || "").replace(/[^\d]/g, "");
    const parsed = Number.parseInt(digits, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };

  const parseRating = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    const match = String(value || "").match(/([0-4](?:\.\d+)?|5(?:\.0+)?)/);
    const parsed = match ? Number.parseFloat(match[1]) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseTrailingCountLine = (line) => {
    const trimmed = String(line || "").trim();

    if (!trimmed) {
      return null;
    }

    const match = trimmed.match(/^(.*?)(\d[\d,]*)$/);

    if (!match) {
      return null;
    }

    const label = match[1].trim();
    const count = parseCount(match[2]);

    if (!label || count <= 0) {
      return null;
    }

    return [label, count];
  };

  const looksLikeHeading = (line, keywords) => {
    const normalized = normalizeCompact(line);
    return keywords.some((keyword) => normalized.includes(normalizeCompact(keyword)));
  };

  const findFirstLineIndex = (keywords) =>
    lines.findIndex((line) => looksLikeHeading(line, keywords));

  const extractPairList = (sectionLines, { positiveKeywords, negativeKeywords, stopKeywords }) => {
    const positive = [];
    const negative = [];
    let state = null;
    let pendingLabel = "";

    const pushEntry = (bucket, entry) => {
      if (!entry) {
        return;
      }

      const duplicate = bucket.some(
        ([label, count]) => label === entry[0] && count === entry[1],
      );

      if (!duplicate) {
        bucket.push(entry);
      }
    };

    for (const line of sectionLines) {
      if (looksLikeHeading(line, stopKeywords)) {
        break;
      }

      if (looksLikeHeading(line, positiveKeywords)) {
        state = "positive";
        pendingLabel = "";
        continue;
      }

      if (looksLikeHeading(line, negativeKeywords)) {
        state = "negative";
        pendingLabel = "";
        continue;
      }

      if (!state) {
        continue;
      }

      const parsedLine = parseTrailingCountLine(line);

      if (parsedLine) {
        pushEntry(state === "positive" ? positive : negative, parsedLine);
        pendingLabel = "";
        continue;
      }

      if (/^\d[\d,]*$/.test(line) && pendingLabel) {
        pushEntry(
          state === "positive" ? positive : negative,
          [pendingLabel, parseCount(line)],
        );
        pendingLabel = "";
        continue;
      }

      pendingLabel = line;
    }

    return { positive, negative };
  };

  const extractReviewRaw = () => {
    const startIndex = findFirstLineIndex([
      "AI review summary",
      "AI review",
      "AI 리뷰 요약",
      "AI 리뷰",
      "좋아요",
      "아쉬워요",
    ]);

    if (startIndex < 0) {
      return {
        positive: [],
        negative: [],
      };
    }

    const reviewWindow = lines.slice(startIndex, startIndex + 180);

    return extractPairList(reviewWindow, {
      positiveKeywords: ["좋아요", "liked", "pros"],
      negativeKeywords: ["아쉬워요", "disliked", "cons"],
      stopKeywords: [
        "성분 분석",
        "전성분",
        "ingredient",
        "rating distribution",
        "평점 분포",
        "피부 타입별",
      ],
    });
  };

  const findMaxCountFromPatterns = (patterns) => {
    const values = [];

    patterns.forEach((pattern) => {
      let match;
      const regex = new RegExp(pattern, "gi");

      while ((match = regex.exec(bodyText))) {
        values.push(parseCount(match[1] || match[2] || 0));
      }
    });

    return values.length ? Math.max(...values) : 0;
  };

  const extractFirstRating = () => {
    for (const line of lines) {
      const compact = normalizeCompact(line);

      if (!/(rating|평점|별점)/.test(compact)) {
        continue;
      }

      const rating = parseRating(line);

      if (rating > 0 && rating <= 5) {
        return rating;
      }
    }

    const fallbackMatch = bodyText.match(/([0-4](?:\.\d+)?|5(?:\.0+)?)\s*(?:\/\s*5|점|stars?)/i);
    return fallbackMatch ? parseRating(fallbackMatch[1]) : 0;
  };

  const extractRatingDistribution = () => {
    const distribution = {};

    lines.forEach((line) => {
      const match = line.match(/^\s*([1-5])\s*(?:점|star|stars)\s*[:\-]?\s*(\d[\d,]*%?)\s*$/i);

      if (match) {
        distribution[match[1]] = match[2].includes("%")
          ? match[2]
          : parseCount(match[2]);
      }
    });

    return distribution;
  };

  const extractMarketRaw = () => ({
    review_count: findMaxCountFromPatterns([
      "(\\d[\\d,]*)\\s*(?:개\\s*)?리뷰",
      "reviews?\\s*[:]?\\s*(\\d[\\d,]*)",
      "(\\d[\\d,]*)\\s*reviews?",
    ]),
    rating: extractFirstRating(),
    rating_distribution: extractRatingDistribution(),
  });

  const extractCountForKeywords = (keywords) => {
    for (const line of lines) {
      const compact = normalizeCompact(line);

      if (!keywords.some((keyword) => compact.includes(normalizeCompact(keyword)))) {
        continue;
      }

      const count = parseCount(line);

      if (count > 0) {
        return count;
      }
    }

    const joinedPattern = keywords
      .map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const regex = new RegExp(`(?:${joinedPattern})[^\\d]{0,12}(\\d[\\d,]*)`, "i");
    const match = bodyText.match(regex);
    return match ? parseCount(match[1]) : 0;
  };

  const FUNCTIONAL_LABELS = [
    { key: "skin hydration", keywords: ["skin hydration", "피부 보습"] },
    {
      key: "moisture evaporation blocking",
      keywords: ["moisture evaporation blocking", "수분 증발 차단", "수분 증발 방지"],
    },
    { key: "skin protection", keywords: ["skin protection", "피부 보호"] },
    {
      key: "soothing/astringent",
      keywords: ["soothing/astringent", "진정", "수렴"],
    },
    { key: "exfoliation", keywords: ["exfoliation", "각질 제거"] },
    { key: "whitening", keywords: ["whitening", "미백"] },
    { key: "acne relief", keywords: ["acne relief", "여드름 완화"] },
    { key: "UV protection", keywords: ["uv protection", "자외선 차단"] },
  ];

  const extractFunctionalSignals = () => {
    const functional = {};

    FUNCTIONAL_LABELS.forEach(({ key, keywords }) => {
      const count = extractCountForKeywords(keywords);

      if (count > 0) {
        functional[key] = count;
      }
    });

    return functional;
  };

  const extractSkinTypeCounts = () => {
    const skinTypes = [
      {
        key: "oily",
        positiveKeywords: ["지성 피부에 좋은", "oily skin positive", "good for oily skin"],
        negativeKeywords: ["지성 피부에 안 좋은", "oily skin negative", "bad for oily skin"],
      },
      {
        key: "dry",
        positiveKeywords: ["건성 피부에 좋은", "dry skin positive", "good for dry skin"],
        negativeKeywords: ["건성 피부에 안 좋은", "dry skin negative", "bad for dry skin"],
      },
      {
        key: "sensitive",
        positiveKeywords: ["민감성 피부에 좋은", "sensitive skin positive", "good for sensitive skin"],
        negativeKeywords: ["민감성 피부에 안 좋은", "sensitive skin negative", "bad for sensitive skin"],
      },
    ];

    const result = {};

    skinTypes.forEach(({ key, positiveKeywords, negativeKeywords }) => {
      result[key] = {
        positive: extractCountForKeywords(positiveKeywords),
        negative: extractCountForKeywords(negativeKeywords),
      };
    });

    return result;
  };

  const extractIngredientRaw = () => ({
    total_ingredients: extractCountForKeywords(["전성분", "total ingredients"]),
    risk: {
      low: extractCountForKeywords(["저위험", "low risk"]),
      medium: extractCountForKeywords(["중위험", "medium risk"]),
      high: extractCountForKeywords(["고위험", "high risk"]),
      unknown: extractCountForKeywords(["미확인", "unknown risk", "unknown"]),
    },
    functional: extractFunctionalSignals(),
    skin_type: extractSkinTypeCounts(),
  });

  const result = {
    productId: PRODUCT_ID_PLACEHOLDER,
    review_raw: extractReviewRaw(),
    market_raw: extractMarketRaw(),
    ingredient_raw: extractIngredientRaw(),
  };

  const jsonText = JSON.stringify(result, null, 2);
  let copied = false;

  try {
    if (typeof copy === "function") {
      copy(jsonText);
      copied = true;
    } else if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(jsonText);
      copied = true;
    }
  } catch (error) {
    console.warn("[hwahae-console-extractor] Clipboard copy failed:", error);
  }

  console.log("[hwahae-console-extractor] raw output", result);
  console.log(
    copied
      ? "[hwahae-console-extractor] JSON copied to clipboard. Replace productId before saving."
      : "[hwahae-console-extractor] Copy failed. Use the returned object or JSON from the console.",
  );

  return result;
})();
