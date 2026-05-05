#!/usr/bin/env node

/*
Promo content generator
Usage: npm run promo:generate

Edit data/promo-seeds.json with product, skin type, concern, and angle inputs.
This script uses local rules only. It does not call external APIs.
*/

import fs from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.cwd();
const SEEDS_PATH = path.join(ROOT_DIR, "data", "promo-seeds.json");
const OUTPUT_DIR = path.join(ROOT_DIR, "content", "promo", "generated");
const JSON_OUTPUT_PATH = path.join(OUTPUT_DIR, "promo-content.json");
const CSV_OUTPUT_PATH = path.join(OUTPUT_DIR, "promo-content.csv");

const PLATFORM_TARGETS = ["tiktok", "instagram_reels", "youtube_shorts"];

const DEFAULT_SEEDS = [
  {
    id: "oliveyoung-overload-heartleaf-toner",
    productName: "Heartleaf 77 Soothing Toner",
    brand: "Anua",
    skinType: "combination",
    concerns: ["visible redness", "uneven texture", "routine overwhelm"],
    contentAngle: "oliveyoung_overload",
    recommendationResult: "A calm toner step for a simple first layer.",
    routineStep: "toner",
    texture: "watery",
    keyIngredients: ["heartleaf extract"],
  },
  {
    id: "oily-skin-green-tea-serum",
    productName: "Green Tea Seed Hyaluronic Serum",
    brand: "Innisfree",
    skinType: "oily",
    concerns: ["midday shine", "dehydrated feel"],
    contentAngle: "oily_skin",
    recommendationResult: "A light serum option that keeps the routine fresh.",
    routineStep: "serum",
    texture: "lightweight gel",
    keyIngredients: ["green tea", "hyaluronic acid"],
  },
  {
    id: "dry-skin-birch-cream",
    productName: "Birch 70 Moisture Calming Cream",
    brand: "Round Lab",
    skinType: "dry",
    concerns: ["tight feel", "flaky-looking texture"],
    contentAngle: "dry_skin",
    recommendationResult: "A moisture-first cream for a soft finish.",
    routineStep: "moisturizer",
    texture: "soft cream",
    keyIngredients: ["birch sap", "panthenol"],
  },
  {
    id: "sensitive-skin-centella-ampoule",
    productName: "Madagascar Centella Ampoule",
    brand: "SKIN1004",
    skinType: "sensitive",
    concerns: ["easily reactive feel", "visible redness"],
    contentAngle: "sensitive_skin",
    recommendationResult: "A minimal ampoule pick for low-drama layering.",
    routineStep: "ampoule",
    texture: "watery",
    keyIngredients: ["centella asiatica extract"],
  },
  {
    id: "acne-concern-snail-essence",
    productName: "Advanced Snail 96 Mucin Power Essence",
    brand: "COSRX",
    skinType: "combination",
    concerns: ["post-blemish look", "rough-looking texture"],
    contentAngle: "acne_concern",
    recommendationResult: "A simple essence step for a smoother-looking routine.",
    routineStep: "essence",
    texture: "bouncy essence",
    keyIngredients: ["snail mucin"],
  },
  {
    id: "sunscreen-choice-relief-sun",
    productName: "Relief Sun Rice + Probiotics SPF50+",
    brand: "Beauty of Joseon",
    skinType: "normal",
    concerns: ["daily UV exposure", "white cast worry"],
    contentAngle: "sunscreen_choice",
    recommendationResult: "A daily sunscreen pick with a comfortable finish.",
    routineStep: "sunscreen",
    texture: "creamy lotion",
    keyIngredients: ["rice extract", "probiotics"],
  },
  {
    id: "routine-builder-dive-in-serum",
    productName: "Dive-In Low Molecular Hyaluronic Acid Serum",
    brand: "Torriden",
    skinType: "dehydrated",
    concerns: ["tight feel", "dull-looking skin"],
    contentAngle: "routine_builder",
    recommendationResult: "A hydration layer that fits into a three-step routine.",
    routineStep: "serum",
    texture: "light gel serum",
    keyIngredients: ["hyaluronic acid", "panthenol"],
  },
  {
    id: "avoid-mistake-red-blemish-cream",
    productName: "Red Blemish Clear Soothing Cream",
    brand: "Dr. G",
    skinType: "combination",
    concerns: ["visible redness", "heavy routine feel"],
    contentAngle: "avoid_mistake",
    recommendationResult: "A soothing cream option when the routine needs restraint.",
    routineStep: "moisturizer",
    texture: "gel cream",
    keyIngredients: ["cica complex"],
  },
  {
    id: "sunscreen-choice-watery-sun-gel",
    productName: "Hyaluronic Acid Watery Sun Gel SPF50+",
    brand: "Isntree",
    skinType: "combination",
    concerns: ["sticky sunscreen feel", "daily UV exposure"],
    contentAngle: "sunscreen_choice",
    recommendationResult: "A watery sunscreen pick for a lighter morning finish.",
    routineStep: "sunscreen",
    texture: "watery gel",
    keyIngredients: ["hyaluronic acid"],
  },
  {
    id: "oliveyoung-overload-glow-serum",
    productName: "Dark Spot Correcting Glow Serum",
    brand: "AXIS-Y",
    skinType: "dull-looking",
    concerns: ["uneven tone look", "post-blemish marks"],
    contentAngle: "oliveyoung_overload",
    recommendationResult: "A focused serum pick when the shelf feels too loud.",
    routineStep: "serum",
    texture: "light gel serum",
    keyIngredients: ["niacinamide", "squalane"],
  },
];

const ANGLE_RULES = {
  oliveyoung_overload: {
    hook: ({ productName }) => `Too many K-beauty choices? Start with ${productName}.`,
    problem: () => "The shelf looks exciting, then suddenly impossible.",
    focusLine: ({ concerns }) => `Pick one concern first: ${formatList(concerns)}.`,
    routineLine: ({ routineStep }) => `Make it one clear ${routineStep} step.`,
    caption: ({ productName, brand }) =>
      `Choice overload is real. Start with one skin goal and one pick, like ${brand} ${productName}. Patch test and keep the routine simple.`,
    cta: () => "Save this before your next Olive Young scroll.",
    hashtags: ["#KBeauty", "#OliveYoungFinds", "#SkincareRoutine", "#BeautyShorts"],
    visualNotes: [
      "Open on a fast shelf scroll.",
      "Cut to one product in the center.",
      "Use simple arrows and one concern label.",
    ],
  },
  oily_skin: {
    hook: () => "Oily by noon? Your routine may need a lighter layer.",
    problem: () => "Heavy layers can make shine feel louder.",
    focusLine: ({ concerns }) => `Keep the goal simple: ${formatList(concerns)}.`,
    routineLine: ({ texture, routineStep }) => `Try a ${texture} ${routineStep} before adding more.`,
    caption: ({ productName, brand }) =>
      `For oily skin days, keep layers light and easy. ${brand} ${productName} is a simple pick to test in a balanced routine.`,
    cta: () => "Save this for your next lighter routine reset.",
    hashtags: ["#OilySkinRoutine", "#KBeauty", "#SkincareTips", "#Shorts"],
    visualNotes: [
      "Show blotting paper or midday mirror check.",
      "Use a light texture swipe shot.",
      "End with a clean two-step routine layout.",
    ],
  },
  dry_skin: {
    hook: () => "Dry skin feeling tight? Build moisture before glow.",
    problem: () => "Glow makeup cannot do all the work when skin feels tight.",
    focusLine: ({ concerns }) => `Focus on ${formatList(concerns)} first.`,
    routineLine: ({ texture, routineStep }) => `Add a ${texture} ${routineStep} and keep it steady.`,
    caption: ({ productName, brand }) =>
      `When dry skin feels tight, choose comfort over a crowded routine. Try a moisture-first pick like ${brand} ${productName}.`,
    cta: () => "Save this for your dry-skin checklist.",
    hashtags: ["#DrySkinRoutine", "#KBeauty", "#SkinBarrierCare", "#BeautyShorts"],
    visualNotes: [
      "Start with tight-skin text overlay.",
      "Show cream texture on fingertips.",
      "Use warm lighting and soft close-ups.",
    ],
  },
  sensitive_skin: {
    hook: () => "Sensitive-feeling skin? Fewer steps can be the flex.",
    problem: () => "Too many new products at once can make feedback confusing.",
    focusLine: ({ concerns }) => `Watch for ${formatList(concerns)} without overloading the routine.`,
    routineLine: ({ routineStep }) => `Keep this as one quiet ${routineStep} step.`,
    caption: ({ productName, brand }) =>
      `For sensitive-feeling skin, keep changes slow and simple. ${brand} ${productName} can be tested as one focused step.`,
    cta: () => "Save this if your routine needs a calmer edit.",
    hashtags: ["#SensitiveSkinRoutine", "#KBeauty", "#MinimalSkincare", "#Reels"],
    visualNotes: [
      "Show a messy routine, then remove extra products.",
      "Use calm neutral colors.",
      "Add a clear patch-test reminder.",
    ],
  },
  acne_concern: {
    hook: () => "Breakout-prone days? Do not turn the routine into chaos.",
    problem: () => "Adding five new steps makes it harder to know what works for you.",
    focusLine: ({ concerns }) => `Keep the focus cosmetic: ${formatList(concerns)}.`,
    routineLine: ({ routineStep }) => `Use one supportive ${routineStep} and track how skin feels.`,
    caption: ({ productName, brand }) =>
      `For breakout-prone days, keep the routine steady and cosmetic-focused. ${brand} ${productName} is one option to patch test slowly.`,
    cta: () => "Save this before adding another random step.",
    hashtags: ["#BreakoutProneSkin", "#KBeautyRoutine", "#SkincareTips", "#Shorts"],
    visualNotes: [
      "Show a routine with too many products crossed out.",
      "Cut to one product plus a simple tracker note.",
      "Keep the tone gentle, not fear-based.",
    ],
  },
  sunscreen_choice: {
    hook: () => "The best sunscreen is the one you will actually wear.",
    problem: () => "Sticky texture or white cast worry can make daily SPF harder.",
    focusLine: ({ concerns }) => `Choose around your real friction: ${formatList(concerns)}.`,
    routineLine: ({ texture }) => `Look for a ${texture} finish that fits your morning.`,
    caption: ({ productName, brand }) =>
      `Daily SPF gets easier when the texture fits your life. ${brand} ${productName} is a K-beauty sunscreen option to test.`,
    cta: () => "Save this for your next sunscreen comparison.",
    hashtags: ["#SunscreenRoutine", "#KBeautySPF", "#SkincareTips", "#YouTubeShorts"],
    visualNotes: [
      "Compare two texture swatches.",
      "Show a morning bag or vanity setup.",
      "End with SPF as the final AM step.",
    ],
  },
  routine_builder: {
    hook: () => "New to K-beauty? Build the routine in three steps.",
    problem: () => "A long routine looks fun, but it is harder to keep consistent.",
    focusLine: ({ concerns }) => `Start with one goal: ${formatList(concerns)}.`,
    routineLine: ({ routineStep }) => `Place this ${routineStep} after cleansing and before cream.`,
    caption: ({ productName, brand }) =>
      `Keep the starter routine simple: cleanse, one focused layer, moisturize, then SPF in the morning. ${brand} ${productName} can be the focused layer.`,
    cta: () => "Save this simple routine map.",
    hashtags: ["#KBeautyBeginner", "#RoutineBuilder", "#SkincareRoutine", "#Reels"],
    visualNotes: [
      "Use a three-card routine layout.",
      "Animate product placement into the middle card.",
      "Keep the text large and beginner-friendly.",
    ],
  },
  avoid_mistake: {
    hook: () => "One common skincare mistake: changing everything at once.",
    problem: () => "If every step is new, your skin feedback gets noisy.",
    focusLine: ({ concerns }) => `Pick one concern lane: ${formatList(concerns)}.`,
    routineLine: ({ routineStep }) => `Add one ${routineStep}, then wait before changing more.`,
    caption: ({ productName, brand }) =>
      `Routine mistake to avoid: swapping every step at once. Test one product at a time, like ${brand} ${productName}, and keep notes.`,
    cta: () => "Save this before your next routine overhaul.",
    hashtags: ["#SkincareMistakes", "#KBeautyTips", "#RoutineReset", "#Shorts"],
    visualNotes: [
      "Open with too many products dropping into frame.",
      "Freeze frame on one chosen product.",
      "End with a simple one-product testing note.",
    ],
  },
};

const SAFE_REPLACEMENTS = [
  { pattern: /\bcures?\b/gi, replacement: "supports" },
  { pattern: /\bguaranteed\b/gi, replacement: "steady" },
  { pattern: /\bmedical treatment\b/gi, replacement: "skincare step" },
  { pattern: /\btreats?\b/gi, replacement: "supports" },
  { pattern: /\bheals?\b/gi, replacement: "comforts" },
];

function formatList(items) {
  const values = Array.isArray(items) ? items.filter(Boolean) : [items].filter(Boolean);

  if (values.length <= 1) {
    return values[0] || "one skin concern";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSeed(seed, index) {
  const contentAngle = seed.contentAngle || "routine_builder";

  if (!ANGLE_RULES[contentAngle]) {
    throw new Error(
      `Unsupported contentAngle "${contentAngle}" in seed ${seed.id || index + 1}. ` +
        `Supported angles: ${Object.keys(ANGLE_RULES).join(", ")}`,
    );
  }

  const productName = requireText(seed.productName, `seed ${index + 1} productName`);
  const brand = requireText(seed.brand, `seed ${index + 1} brand`);

  return {
    id: seed.id || `${slugify(brand)}-${slugify(productName)}`,
    productName,
    brand,
    skinType: requireText(seed.skinType, `seed ${index + 1} skinType`),
    concerns: normalizeStringArray(seed.concerns, `seed ${index + 1} concerns`),
    contentAngle,
    recommendationResult:
      seed.recommendationResult || "A focused K-beauty pick for a simple routine.",
    routineStep: seed.routineStep || "routine",
    texture: seed.texture || "comfortable",
    keyIngredients: normalizeStringArray(seed.keyIngredients || [], `seed ${index + 1} keyIngredients`),
  };
}

function normalizeStringArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

function requireText(value, label) {
  const text = String(value || "").trim();

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function buildSceneScript(seed, rule) {
  const ingredientText = seed.keyIngredients.length
    ? `Look for ${formatList(seed.keyIngredients.slice(0, 2))}.`
    : "Keep the layer simple.";

  return [
    {
      scene: 1,
      durationSec: 2,
      onScreenText: "Stop the scroll",
      voiceover: rule.hook(seed),
      visual: "Fast product shelf or vanity scroll, then a quick freeze frame.",
    },
    {
      scene: 2,
      durationSec: 3,
      onScreenText: `Skin type: ${seed.skinType}`,
      voiceover: rule.problem(seed),
      visual: "Creator points to one short skin-type label on screen.",
    },
    {
      scene: 3,
      durationSec: 3,
      onScreenText: `Concern: ${formatList(seed.concerns)}`,
      voiceover: rule.focusLine(seed),
      visual: "Close-up of a note card with one clear skin goal.",
    },
    {
      scene: 4,
      durationSec: 3,
      onScreenText: `${seed.brand} pick`,
      voiceover: `The recommendation is ${seed.productName}.`,
      visual: "Product hero shot with clean lighting and no crowded background.",
    },
    {
      scene: 5,
      durationSec: 3,
      onScreenText: seed.texture,
      voiceover: `${rule.routineLine(seed)} ${ingredientText}`,
      visual: "Texture swatch, then product placed into the routine order.",
    },
    {
      scene: 6,
      durationSec: 2,
      onScreenText: "Patch test first",
      voiceover: `${seed.recommendationResult} ${rule.cta(seed)}`,
      visual: "End card with product, skin type, and save prompt.",
    },
  ];
}

function buildSubtitles(seed, rule) {
  return [
    rule.hook(seed),
    rule.problem(seed),
    rule.focusLine(seed),
    `${seed.brand} ${seed.productName}.`,
    rule.routineLine(seed),
    "Patch test first.",
    rule.cta(seed),
  ].map(shortenSubtitle);
}

function shortenSubtitle(text) {
  const cleaned = sanitizeText(text);

  if (cleaned.length <= 72) {
    return cleaned;
  }

  return `${cleaned.slice(0, 69).trim()}...`;
}

function buildContent(seed, index) {
  const normalized = normalizeSeed(seed, index);
  const rule = ANGLE_RULES[normalized.contentAngle];

  const content = {
    id: `promo-${String(index + 1).padStart(3, "0")}-${slugify(normalized.id)}`,
    platformTargets: PLATFORM_TARGETS,
    hook: rule.hook(normalized),
    problem: rule.problem(normalized),
    sceneScript: buildSceneScript(normalized, rule),
    subtitles: buildSubtitles(normalized, rule),
    caption: rule.caption(normalized),
    hashtags: rule.hashtags,
    cta: rule.cta(normalized),
    visualNotes: rule.visualNotes,
    productName: normalized.productName,
    brand: normalized.brand,
    skinType: normalized.skinType,
    concerns: normalized.concerns,
    contentAngle: normalized.contentAngle,
  };

  return sanitizeContent(content);
}

function sanitizeContent(value) {
  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeContent);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeContent(item)]),
    );
  }

  return value;
}

function sanitizeText(text) {
  return SAFE_REPLACEMENTS.reduce(
    (current, rule) => current.replace(rule.pattern, rule.replacement),
    String(text),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function toCsv(contents) {
  const columns = [
    "id",
    "hook",
    "caption",
    "hashtags",
    "cta",
    "productName",
    "brand",
    "skinType",
    "concerns",
    "contentAngle",
  ];

  const rows = contents.map((content) =>
    columns
      .map((column) => {
        const value = content[column];

        if (Array.isArray(value)) {
          return csvEscape(column === "hashtags" ? value.join(" ") : value.join("; "));
        }

        return csvEscape(value ?? "");
      })
      .join(","),
  );

  return [columns.join(","), ...rows].join("\n");
}

function csvEscape(value) {
  const text = String(value);

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

async function loadSeeds() {
  await fs.mkdir(path.dirname(SEEDS_PATH), { recursive: true });

  try {
    const raw = await fs.readFile(SEEDS_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error("data/promo-seeds.json must contain a JSON array.");
    }

    return parsed;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    await fs.writeFile(`${SEEDS_PATH}`, `${JSON.stringify(DEFAULT_SEEDS, null, 2)}\n`);
    return DEFAULT_SEEDS;
  }
}

function logStatus(kind, message) {
  const prefixes = {
    success: "[ok]",
    warn: "[warn]",
    error: "[error]",
    info: "[info]",
  };

  process.stdout.write(`${prefixes[kind] || "[info]"} ${message}\n`);
}

async function main() {
  const seeds = await loadSeeds();
  const contents = seeds.map(buildContent);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(JSON_OUTPUT_PATH, `${JSON.stringify(contents, null, 2)}\n`);
  await fs.writeFile(CSV_OUTPUT_PATH, `${toCsv(contents)}\n`);

  logStatus("success", `Generated ${contents.length} promo content items.`);
  logStatus("success", `JSON: ${JSON_OUTPUT_PATH}`);
  logStatus("success", `CSV: ${CSV_OUTPUT_PATH}`);
}

main().catch((error) => {
  logStatus("error", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
