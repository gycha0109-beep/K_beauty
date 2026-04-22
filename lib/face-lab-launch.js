function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function compactList(values, limit = 4) {
  return Array.isArray(values)
    ? values.map((item) => cleanText(item)).filter(Boolean).slice(0, limit)
    : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function buildFaceLabLaunchData(faceLab, locale = "ko") {
  const isEnglish = locale === "en";

  if (faceLab?.free?.impressionLine || faceLab?.free?.shapeLine || faceLab?.free?.styleLine) {
    return {
      free: {
        impressionLine: cleanText(faceLab?.free?.impressionLine),
        shapeLine: cleanText(faceLab?.free?.shapeLine),
        styleLine: cleanText(faceLab?.free?.styleLine)
      },
      paid: {
        hairDirection: compactList(faceLab?.paid?.hairDirection, 3),
        avoidStyles: compactList(faceLab?.paid?.avoidStyles, 2),
        colorPalette: compactList(faceLab?.paid?.colorPalette, 4),
        vibeKeywords: compactList(faceLab?.paid?.vibeKeywords, 4)
      }
    };
  }

  if (faceLab?.impressionLine || faceLab?.shapeLine || faceLab?.styleLine) {
    return {
      free: {
        impressionLine: cleanText(faceLab?.impressionLine),
        shapeLine: cleanText(faceLab?.shapeLine),
        styleLine: cleanText(faceLab?.styleLine)
      },
      paid: {
        hairDirection: [],
        avoidStyles: [],
        colorPalette: [],
        vibeKeywords: []
      }
    };
  }

  const impressionLine =
    cleanText(faceLab?.features?.physiognomy?.headline_result) ||
    cleanText(faceLab?.features?.physiognomy?.overall_impression) ||
    (isEnglish ? "Face Lab will add a short impression read here." : "Face Lab에서 짧은 인상 리드를 여기에 붙입니다.");
  const shapeLine =
    cleanText(faceLab?.features?.face_shape_hairstyle?.summary) ||
    cleanText(faceLab?.base_data?.face_shape) ||
    (isEnglish ? "Face shape direction will show here." : "얼굴형 방향성이 여기에 표시됩니다.");
  const styleLine =
    cleanText(faceLab?.features?.lookalike_celebrities?.summary) ||
    compactList(faceLab?.features?.face_shape_hairstyle?.recommendations, 1)[0] ||
    (isEnglish ? "A short style direction will show here." : "짧은 스타일 방향이 여기에 표시됩니다.");

  return {
    free: {
      impressionLine,
      shapeLine,
      styleLine
    },
    paid: {
      hairDirection: compactList(faceLab?.features?.face_shape_hairstyle?.recommendations, 3),
      avoidStyles: compactList(faceLab?.features?.face_shape_hairstyle?.avoid, 2),
      colorPalette: compactList(faceLab?.features?.color_tone_recommendation?.palette, 4),
      vibeKeywords: unique([
        cleanText(faceLab?.features?.physiognomy?.headline_label),
        ...compactList(faceLab?.features?.physiognomy?.interpretation_axes, 2),
        ...compactList(faceLab?.base_data?.embedding, 2)
      ]).slice(0, 4)
    }
  };
}
