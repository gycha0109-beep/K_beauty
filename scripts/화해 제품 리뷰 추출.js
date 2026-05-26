/*
  Hwahae visible-page extractor
  - Run this in the browser console on an already opened Hwahae product page.
  - It only reads document.body.innerText from the current page.
  - It does not log in, make network requests, or use Playwright.
  - Replace productId before saving the JSON.
*/

globalThis.__hwahaeExtractFromText = function __hwahaeExtractFromText(rawText) {
  const PRODUCT_ID_PLACEHOLDER = "USER_MUST_REPLACE_SUPABASE_PRODUCT_ID";
  const bodyText = String(rawText || "");
  const lines = bodyText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const K = {
    aiReview: "\u0041\u0049 \ub9ac\ubdf0",
    like: "\uc88b\uc544\uc694",
    dislike: "\uc544\uc26c\uc6cc\uc694",
    review: "\ub9ac\ubdf0",
    rating: "\ud3c9\uc810",
    starRating: "\ubcc4\uc810",
    point: "\uc810",
    totalIngredients: "\uc804\uccb4 \uc131\ubd84",
    lowRisk: "\ub0ae\uc740 \uc704\ud5d8",
    mediumRisk: "\uc911\uac04 \uc704\ud5d8",
    highRisk: "\ub192\uc740 \uc704\ud5d8",
    unknownRisk: "\ub4f1\uae09 \ubbf8\uc815",
    functionalIngredients: "\ubaa9\uc801\ubcc4 \uc131\ubd84",
    skinTypeIngredients: "\ud53c\ubd80 \ud0c0\uc785\ubcc4 \uc131\ubd84",
    oilySkin: "\uc9c0\uc131 \ud53c\ubd80",
    drySkin: "\uac74\uc131 \ud53c\ubd80",
    sensitiveSkin: "\ubbfc\uac10\uc131 \ud53c\ubd80",
    skinHydration: "\ud53c\ubd80 \ubcf4\uc2b5",
    skinProtection: "\ud53c\ubd80 \ubcf4\ud638",
    exfoliation: "\uac01\uc9c8 \uc81c\uac70",
    moistureEvaporationBlocking: "\uc218\ubd84 \uc99d\ubc1c \ucc28\ub2e8",
    soothingAstringent: "\uc218\ub834 \uc9c4\uc815",
    whitening: "\ud53c\ubd80 \ubbf8\ubc31",
    acneRelief: "\uc5ec\ub4dc\ub984 \uc644\ud654",
    uvProtection: "\uc790\uc678\uc120 \ucc28\ub2e8",
    wrinkleImprovement: "\uc8fc\ub984 \uac1c\uc120",
  };

  const normalize = (value) =>
    String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const normalizeCompact = (value) =>
    normalize(value).replace(/[^a-z0-9\uac00-\ud7af]/g, "");

  const escapeRegex = (value) =>
    String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const readNumbersInText = (value) =>
    Array.from(String(value || "").matchAll(/\d[\d,]*/g), (match) => parseCount(match[0]));

  function parseCount(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.round(value));
    }

    const digits = String(value || "").replace(/[^\d]/g, "");
    const parsed = Number.parseInt(digits, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function parseRating(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 1 && value <= 5 ? value : 0;
  }

  const text = String(value || "").trim();

  // "5점", "4점", "5점 659" 같은 별점 분포 라인은 평점으로 보지 않음
  if (/^[1-5]\s*점(?:\s+\d[\d,]*)?$/.test(text)) {
    return 0;
  }

  // 평균 평점은 보통 4.68처럼 소수점 2자리/1자리
  const match = text.match(/(?:^|[^\d])([1-4]\.\d{1,2}|5\.0{1,2})(?:[^\d]|$)/);
  const parsed = match ? Number.parseFloat(match[1]) : Number.NaN;

  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 0;
}

  const containsKeyword = (line, keywords) => {
    const compact = normalizeCompact(line);
    return keywords.some((keyword) => compact.includes(normalizeCompact(keyword)));
  };

  const findFirstIndex = (keywords, startIndex = 0) => {
    for (let index = Math.max(0, startIndex); index < lines.length; index += 1) {
      if (containsKeyword(lines[index], keywords)) {
        return index;
      }
    }

    return -1;
  };

  const findNextSectionIndex = (startIndex, sectionKeywordSets) => {
    if (startIndex < 0) {
      return -1;
    }

    for (let index = startIndex + 1; index < lines.length; index += 1) {
      if (sectionKeywordSets.some((keywords) => containsKeyword(lines[index], keywords))) {
        return index;
      }
    }

    return lines.length;
  };

  const isIntegerCountLine = (line) => /^\d[\d,]*$/.test(String(line || "").trim());
  const isRangeLabel = (line) => /^\d+\s*-\s*\d+$/.test(String(line || "").trim());
  const isRatingOnlyLine = (line) => /^(?:[1-4]\.\d+|5\.0+)$/.test(String(line || "").trim());
  const isNumericOnlyLine = (line) => {
    const trimmed = String(line || "").trim();
    return Boolean(trimmed) && !/[a-zA-Z\uac00-\ud7af]/.test(trimmed) && readNumbersInText(trimmed).length > 0;
  };
  const isRatingDistributionLine = (line) =>
    new RegExp(`^[1-5]${escapeRegex(K.point)}(?:\\s+\\d[\\d,]*)?$`).test(String(line || "").trim());

  const reviewCompact = normalizeCompact(K.review);
  const isReviewCountLine = (line) => {
    const compact = normalizeCompact(line);
    return compact.startsWith(reviewCompact) || compact.endsWith(reviewCompact);
  };

  const looksLikeMarketBoundary = (line) =>
    isReviewCountLine(line) || isRatingOnlyLine(line) || isRatingDistributionLine(line);

  const REVIEW_START_KEYWORDS = [K.aiReview, "ai review", K.like, K.dislike];
  const INGREDIENT_KEYWORDS = [
    K.totalIngredients,
    K.lowRisk,
    K.mediumRisk,
    K.highRisk,
    K.unknownRisk,
  ];
  const FUNCTIONAL_KEYWORDS = [K.functionalIngredients];
  const SKIN_TYPE_KEYWORDS = [K.skinTypeIngredients];

  const FUNCTIONAL_BARS = [
    { key: "skin hydration", label: K.skinHydration },
    { key: "moisture evaporation blocking", label: K.moistureEvaporationBlocking },
    { key: "skin protection", label: K.skinProtection },
    { key: "soothing/astringent", label: K.soothingAstringent },
    { key: "exfoliation", label: K.exfoliation },
    { key: "whitening", label: K.whitening },
    { key: "acne relief", label: K.acneRelief },
    { key: "uv protection", label: K.uvProtection },
    { key: "wrinkle improvement", label: K.wrinkleImprovement },
  ];

  const SKIN_TYPES = [
    { key: "oily", label: K.oilySkin },
    { key: "dry", label: K.drySkin },
    { key: "sensitive", label: K.sensitiveSkin },
  ];

  const reviewStartIndex = findFirstIndex(REVIEW_START_KEYWORDS);
  const ingredientStartIndex = findFirstIndex(INGREDIENT_KEYWORDS);
  const functionalStartIndex = findFirstIndex(FUNCTIONAL_KEYWORDS);
  const skinTypeStartIndex = findFirstIndex(SKIN_TYPE_KEYWORDS);

  const reviewEndIndex = (() => {
    if (reviewStartIndex < 0) {
      return -1;
    }

    for (let index = reviewStartIndex + 1; index < lines.length; index += 1) {
      if (looksLikeMarketBoundary(lines[index])) {
        return index;
      }
    }

    const nextIndex = findNextSectionIndex(reviewStartIndex, [
      INGREDIENT_KEYWORDS,
      FUNCTIONAL_KEYWORDS,
      SKIN_TYPE_KEYWORDS,
    ]);

    return nextIndex > reviewStartIndex ? nextIndex : Math.min(lines.length, reviewStartIndex + 120);
  })();

  const marketStartIndex = reviewStartIndex >= 0 ? reviewEndIndex : 0;
  const marketEndIndex =
    ingredientStartIndex >= 0
      ? ingredientStartIndex
      : functionalStartIndex >= 0
        ? functionalStartIndex
        : skinTypeStartIndex >= 0
          ? skinTypeStartIndex
          : lines.length;

  const ingredientEndIndex =
    functionalStartIndex >= 0
      ? functionalStartIndex
      : skinTypeStartIndex >= 0
        ? skinTypeStartIndex
        : ingredientStartIndex >= 0
          ? findNextSectionIndex(ingredientStartIndex, [FUNCTIONAL_KEYWORDS, SKIN_TYPE_KEYWORDS])
          : -1;

  const functionalEndIndex =
    skinTypeStartIndex >= 0
      ? skinTypeStartIndex
      : functionalStartIndex >= 0
        ? findNextSectionIndex(functionalStartIndex, [SKIN_TYPE_KEYWORDS])
        : -1;

  const reviewLines =
    reviewStartIndex >= 0 && reviewEndIndex > reviewStartIndex
      ? lines.slice(reviewStartIndex, reviewEndIndex)
      : [];
  const marketLines =
    marketEndIndex > marketStartIndex ? lines.slice(marketStartIndex, marketEndIndex) : [];
  const ingredientLines =
    ingredientStartIndex >= 0 && ingredientEndIndex > ingredientStartIndex
      ? lines.slice(ingredientStartIndex, ingredientEndIndex)
      : [];
  const functionalLines =
    functionalStartIndex >= 0 && functionalEndIndex > functionalStartIndex
      ? lines.slice(functionalStartIndex, functionalEndIndex)
      : [];
  const skinTypeLines =
    skinTypeStartIndex >= 0 && skinTypeStartIndex < lines.length
      ? lines.slice(skinTypeStartIndex)
      : [];

  const bannedReviewLabels = new Set(
    [
      K.review,
      "4.",
      "4.43",
      "2026.04.",
      K.totalIngredients,
      K.lowRisk,
      K.mediumRisk,
      K.highRisk,
      K.unknownRisk,
      K.functionalIngredients,
      K.skinTypeIngredients,
    ].map(normalizeCompact),
  );

  const parseReviewPairs = (sectionLines, startKeywords, stopKeywords, maxItems) => {
    const startIndex = sectionLines.findIndex((line) => containsKeyword(line, startKeywords));

    if (startIndex < 0) {
      return [];
    }

    const output = [];
    let pendingLabel = "";

    const pushEntry = (label, count) => {
      const cleanLabel = String(label || "").trim();
      const normalizedLabel = normalizeCompact(cleanLabel);
      const parsedCount = parseCount(count);

      if (!cleanLabel || !normalizedLabel || bannedReviewLabels.has(normalizedLabel)) {
        return false;
      }

      if (isRangeLabel(cleanLabel) || /^\d+(?:\.\d+)?$/.test(cleanLabel) || parsedCount <= 0) {
        return false;
      }

      if (!output.some(([existingLabel]) => normalizeCompact(existingLabel) === normalizedLabel)) {
        output.push([cleanLabel, parsedCount]);
      }

      return output.length >= maxItems;
    };

    for (let index = startIndex + 1; index < sectionLines.length; index += 1) {
      const line = sectionLines[index];

      if (containsKeyword(line, stopKeywords)) {
        break;
      }

      if (
        containsKeyword(line, [
          ...INGREDIENT_KEYWORDS,
          ...FUNCTIONAL_KEYWORDS,
          ...SKIN_TYPE_KEYWORDS,
        ])
      ) {
        break;
      }

            const trailingMatch = line.match(/^(.+?)\s+(\d[\d,]*)$/);

      if (trailingMatch) {
        if (pushEntry(trailingMatch[1], trailingMatch[2])) {
          break;
        }
        pendingLabel = "";
        continue;
      }

      // AI 리뷰에서는 "주름없어지는" 다음 줄의 "5"처럼
      // 단독 정수가 리뷰 카운트일 수 있으므로 market boundary보다 먼저 처리한다.
      if (pendingLabel && isIntegerCountLine(line)) {
        if (pushEntry(pendingLabel, line)) {
          break;
        }
        pendingLabel = "";
        continue;
      }

      if (looksLikeMarketBoundary(line)) {
        break;
      }

      if (!isRangeLabel(line) && !/^\d+(?:\.\d+)?$/.test(line)) {
        pendingLabel = line;
      }
    }

    return output.slice(0, maxItems);
  };

  const extractReviewRaw = () => ({
    positive: parseReviewPairs(reviewLines, [K.like], [K.dislike], 7),
    negative: parseReviewPairs(
      reviewLines,
      [K.dislike],
      [...INGREDIENT_KEYWORDS, ...FUNCTIONAL_KEYWORDS, ...SKIN_TYPE_KEYWORDS],
      7,
    ),
  });

  const extractReviewCount = () => {
    let best = 0;

    marketLines.forEach((line) => {
      if (!isReviewCountLine(line)) {
        return;
      }

      const numbers = readNumbersInText(line);

      if (numbers.length > 0) {
        best = Math.max(best, numbers[0]);
      }
    });

    return best;
  };

  const extractRating = () => {
  // 1순위: 4.68 같은 소수점 평점만 우선 탐색
  for (const line of marketLines) {
    const text = String(line || "").trim();

    if (/^[1-5]\s*점/.test(text)) {
      continue;
    }

    const exactDecimal = text.match(/^(?:[1-4]\.\d{1,2}|5\.0{1,2})$/);

    if (exactDecimal) {
      return Number.parseFloat(exactDecimal[0]);
    }
  }

  // 2순위: "평점 4.68", "별점 4.68" 같은 라인 탐색
  for (const line of marketLines) {
    const text = String(line || "").trim();

    if (/^[1-5]\s*점/.test(text)) {
      continue;
    }

    if (
      text.includes(K.rating) ||
      text.includes(K.starRating)
    ) {
      const rating = parseRating(text);
      if (rating > 0 && rating <= 5) {
        return rating;
      }
    }
  }

  // 3순위: fallback
  for (const line of marketLines) {
    const rating = parseRating(line);

    if (rating > 0 && rating <= 5) {
      return rating;
    }
  }

  return 0;
};

  const extractRatingDistribution = () => {
    const distribution = {};

    for (let index = 0; index < marketLines.length; index += 1) {
      const line = marketLines[index];
      const directMatch = line.match(new RegExp(`^([1-5])${escapeRegex(K.point)}\\s*(\\d[\\d,]*)$`));

      if (directMatch) {
        distribution[directMatch[1]] = parseCount(directMatch[2]);
        continue;
      }

      const labelOnlyMatch = line.match(new RegExp(`^([1-5])${escapeRegex(K.point)}$`));

      if (labelOnlyMatch && isIntegerCountLine(marketLines[index + 1])) {
        distribution[labelOnlyMatch[1]] = parseCount(marketLines[index + 1]);
      }
    }

    return Object.keys(distribution).length === 5 ? distribution : {};
  };

  const extractMarketRaw = () => ({
    review_count: extractReviewCount(),
    rating: extractRating(),
    rating_distribution: extractRatingDistribution(),
  });

  const riskLabels = [
    { key: "total_ingredients", label: K.totalIngredients },
    { key: "low", label: K.lowRisk },
    { key: "medium", label: K.mediumRisk },
    { key: "high", label: K.highRisk },
    { key: "unknown", label: K.unknownRisk },
  ];

  const extractSectionCounts = (sectionLines, knownLabels) => {
    const labelByCompact = new Map(
      knownLabels.map(({ key, label }) => [normalizeCompact(label), { key, label }]),
    );
    const results = Object.fromEntries(knownLabels.map(({ key }) => [key, 0]));
    let pendingKey = "";

    for (const line of sectionLines) {
      if (isRangeLabel(line)) {
        continue;
      }

      const trailingMatch = line.match(/^(.+?)\s+(\d[\d,]*)$/);

      if (trailingMatch) {
        const labelMeta = labelByCompact.get(normalizeCompact(trailingMatch[1]));

        if (labelMeta) {
          results[labelMeta.key] = parseCount(trailingMatch[2]);
          pendingKey = "";
          continue;
        }
      }

      if (pendingKey) {
        const numbers = readNumbersInText(line);

        if (numbers.length > 0) {
          results[pendingKey] = numbers[0];
          pendingKey = "";
          continue;
        }
      }

      const compact = normalizeCompact(line);

      for (const [labelCompact, labelMeta] of labelByCompact.entries()) {
        if (!compact.includes(labelCompact)) {
          continue;
        }

        const lineNumbers = readNumbersInText(line);

        if (lineNumbers.length > 0) {
          results[labelMeta.key] = lineNumbers[lineNumbers.length - 1];
          pendingKey = "";
        } else {
          pendingKey = labelMeta.key;
        }
      }
    }

    return results;
  };

  const extractFunctionalSignals = () => {
    const zeroed = Object.fromEntries(FUNCTIONAL_BARS.map(({ key }) => [key, 0]));
    const contentLines = functionalLines.slice(1);
    const infoStopKeywords = [
      "\uc815\ubcf4\ub294",
      "\ubc30\ud569\ubaa9\uc801",
      "\ud654\uc7a5\ud488\uc758",
      "\uae30\ub2a5\uc131",
      "\ud6a8\ub2a5",
      "\ud6a8\uacfc",
      "\ud3ec\ud568\ub41c \uc131\ubd84",
      "\ub3c4\uc6c0\uc744 \uc8fc\ub294 \uc131\ubd84\uc774 \uc788\uc5b4\uc694",
      "\uc0ac\uc2e4\ub9cc\uc73c\ub85c\ub294",
    ];
    const firstNumberLineIndex = contentLines.findIndex(isNumericOnlyLine);
    const linesUsed = [];
    const collectedBarCounts = [];
    const rawLabelLines = [];
    const collectedLabels = [];
    const pairedResults = [];
    const knownLabels = FUNCTIONAL_BARS.map(({ key, label }) => [key, label, normalize(label)]);

    if (firstNumberLineIndex >= 0) {
      let index = firstNumberLineIndex;

      while (index < contentLines.length) {
        const line = contentLines[index];

        if (!line || containsKeyword(line, [K.skinTypeIngredients])) {
          break;
        }

        if (containsKeyword(line, infoStopKeywords)) {
          break;
        }

        linesUsed.push(line);

        if (isNumericOnlyLine(line)) {
          collectedBarCounts.push(...readNumbersInText(line));
        } else {
          rawLabelLines.push(line);
        }

        index += 1;
      }
    }

    const joinedLabelText = normalize(rawLabelLines.join(" "));
    const orderedLabelMatches = knownLabels
      .map(([key, label, normalizedLabel]) => ({
        key,
        label,
        index: joinedLabelText.indexOf(normalizedLabel),
      }))
      .filter((entry) => entry.index >= 0)
      .sort((left, right) => left.index - right.index);

    orderedLabelMatches.forEach(({ key, label }) => {
      if (!collectedLabels.some((entry) => entry.key === key)) {
        collectedLabels.push({ key, label });
      }
    });

    collectedLabels.forEach(({ key, label }, index) => {
      const count = collectedBarCounts[index] ?? 0;
      zeroed[key] = count;
      pairedResults.push({ label, key, count });
    });

    return {
      values: zeroed,
      debug: {
        linesUsed,
        collectedBarCounts,
        collectedLabels: collectedLabels.map(({ label }) => label),
        pairedResults,
        finalFunctionalObject: { ...zeroed },
      },
    };
  };

  const extractSkinTypeCounts = () => {
    const values = {
      oily: { positive: 0, negative: 0 },
      dry: { positive: 0, negative: 0 },
      sensitive: { positive: 0, negative: 0 },
    };
    const linesUsed = skinTypeLines.slice(1);

    const findCountNearLabel = (blockLines, label) => {
      const labelCompact = normalizeCompact(label);

      for (let index = 0; index < blockLines.length; index += 1) {
        const line = blockLines[index];
        const compact = normalizeCompact(line);

        if (!compact.includes(labelCompact)) {
          continue;
        }

        const inlineMatch = line.match(
          new RegExp(`${escapeRegex(label)}[^\\d]*(\\d[\\d,]*)`),
        );

        if (inlineMatch) {
          return parseCount(inlineMatch[1]);
        }

        const lineNumbers = readNumbersInText(line);

        if (lineNumbers.length > 0) {
          return lineNumbers[lineNumbers.length - 1];
        }

        for (let lookahead = 1; lookahead <= 4; lookahead += 1) {
          const nearbyLine = blockLines[index + lookahead];

          if (!nearbyLine) {
            break;
          }

          const nearbyCompact = normalizeCompact(nearbyLine);

          if (
            nearbyCompact.includes(normalizeCompact(K.like)) ||
            nearbyCompact.includes(normalizeCompact(K.dislike))
          ) {
            if (nearbyCompact.includes(labelCompact)) {
              continue;
            }

            break;
          }

          const nearbyNumbers = readNumbersInText(nearbyLine);

          if (nearbyNumbers.length > 0) {
            return nearbyNumbers[0];
          }
        }
      }

      return 0;
    };

    SKIN_TYPES.forEach(({ key, label }) => {
      const startIndex = linesUsed.findIndex((line) =>
        normalizeCompact(line).includes(normalizeCompact(label)),
      );

      if (startIndex < 0) {
        return;
      }

      let endIndex = linesUsed.length;

      for (let index = startIndex + 1; index < linesUsed.length; index += 1) {
        if (
          SKIN_TYPES.some(({ label: otherLabel }) =>
            normalizeCompact(linesUsed[index]).includes(normalizeCompact(otherLabel)),
          )
        ) {
          endIndex = index;
          break;
        }
      }

      const blockLines = linesUsed.slice(startIndex, endIndex);
      const joined = blockLines.join(" ");
      const explicitBoth = joined.match(
        new RegExp(
          `${escapeRegex(label)}.*?${escapeRegex(K.like)}[^\\d]*(\\d[\\d,]*).*?${escapeRegex(K.dislike)}[^\\d]*(\\d[\\d,]*)`,
        ),
      );

      if (explicitBoth) {
        values[key].positive = parseCount(explicitBoth[1]);
        values[key].negative = parseCount(explicitBoth[2]);
        return;
      }

      const positive = findCountNearLabel(blockLines, K.like);
      const negative = findCountNearLabel(blockLines, K.dislike);

      if (positive > 0 || negative > 0) {
        values[key].positive = positive;
        values[key].negative = negative;
        return;
      }

      const blockNumbers = readNumbersInText(joined);

      if (blockNumbers.length >= 2) {
        values[key].positive = blockNumbers[0];
        values[key].negative = blockNumbers[1];
      } else if (blockNumbers.length === 1) {
        values[key].positive = blockNumbers[0];
        values[key].negative = 0;
      }
    });

    return {
      values,
      debug: {
        linesUsed,
        detectedCounts: values,
      },
    };
  };

  const ingredientCounts = extractSectionCounts(ingredientLines, riskLabels);
  const functional = extractFunctionalSignals();
  const skinType = extractSkinTypeCounts();

  globalThis.__hwahaeLastDebug = {
    functional: functional.debug,
    skinType: skinType.debug,
  };

  return {
    productId: PRODUCT_ID_PLACEHOLDER,
    review_raw: extractReviewRaw(),
    market_raw: extractMarketRaw(),
    ingredient_raw: {
      total_ingredients: ingredientCounts.total_ingredients,
      risk: {
        low: ingredientCounts.low,
        medium: ingredientCounts.medium,
        high: ingredientCounts.high,
        unknown: ingredientCounts.unknown,
      },
      functional: functional.values,
      skin_type: skinType.values,
    },
  };
};

if (typeof window !== "undefined") {
  window.__hwahaeExtractFromText = globalThis.__hwahaeExtractFromText;
}

(async () => {
  if (typeof document === "undefined") {
    return null;
  }

  const extractor = globalThis.__hwahaeExtractFromText;
  const result = extractor(document.body?.innerText || "");
  const debug = globalThis.__hwahaeLastDebug || {};
  const jsonText = JSON.stringify(result, null, 2);
  let copied = false;

  console.log("[hwahae-extractor] version functional-visible-order-fix-20260430");
  console.log("[hwahae-extractor] functional lines:", debug.functional?.linesUsed || []);
  console.log("[hwahae-extractor] functional bar counts collected:", debug.functional?.collectedBarCounts || []);
  console.log("[hwahae-extractor] functional labels collected from actual visible order:", debug.functional?.collectedLabels || []);
  console.log("[hwahae-extractor] paired count->label results:", debug.functional?.pairedResults || []);
  console.log("[hwahae-extractor] final functional object:", debug.functional?.finalFunctionalObject || {});
  console.log("[hwahae-extractor] skin type lines:", debug.skinType?.linesUsed || []);
  console.log("[hwahae-extractor] skin type counts:", debug.skinType?.detectedCounts || {});

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