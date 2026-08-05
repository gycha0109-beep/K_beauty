import { readFileSync } from "node:fs";

function loadExports(path, names, dependencies = {}) {
  const source = readFileSync(path, "utf8")
    .replace(/^import[\s\S]*?;\r?\n/gm, "")
    .replace(/export function /g, "function ");
  const dependencyNames = Object.keys(dependencies);
  return Function(
    ...dependencyNames,
    `${source}\nreturn { ${names.join(", ")} };`
  )(...dependencyNames.map((name) => dependencies[name]));
}

function assertEqual(actual, expected, name) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\nexpected: ${JSON.stringify(expected)}\nactual: ${JSON.stringify(actual)}`);
  }
}

const { formatFaceLabKeywordList, buildFaceLabLaunchData } = loadExports(
  "lib/face-lab-launch.js",
  ["formatFaceLabKeywordList", "buildFaceLabLaunchData"]
);
const { getAvailableVisionFaceLabData } = loadExports(
  "lib/face-lab-result-envelope.js",
  ["getAvailableVisionFaceLabData"],
  { getCanonicalFaceLabObservationAnalysis: () => null }
);

assertEqual(
  formatFaceLabKeywordList(["부드러움", "친근함", "부드러운"], "ko", 3),
  ["부드러움", "친근함"],
  "case 1: concept duplicates"
);
assertEqual(
  formatFaceLabKeywordList(["부드러운", "부드럽게", "부드러움"], "ko", 3),
  ["부드러움"],
  "case 2: suffix variants"
);
assertEqual(
  formatFaceLabKeywordList(["부드러움", "친근함", null], "ko", 3),
  ["부드러움", "친근함"],
  "case 3: null candidate"
);
assertEqual(
  formatFaceLabKeywordList(["부드러움", "특징 1", "fallback only", "placeholder only"], "ko", 3),
  ["부드러움"],
  "case 5: placeholder candidates"
);
assertEqual(
  formatFaceLabKeywordList(["부드러움", "차분함", "친근함"], "ko", 3),
  ["부드러움", "차분함", "친근함"],
  "case 4: separate concepts"
);
assertEqual(
  formatFaceLabKeywordList(["부드러움", "친근함", "차분함", "생동감"], "ko", 3),
  ["부드러움", "친근함", "차분함"],
  "case 6: maximum three"
);

const validStructuredKeywords = buildFaceLabLaunchData({
  structured: {
    mood: {
      status: "available",
      source: "vision",
      evidence: ["features.physiognomy.interpretation_axes: 부드러운"],
      value: { primary: "부드러운", traits: ["부드러움", "친근함", "부드럽게"] }
    }
  }
}).paid.faceMood.keywords;

assertEqual(validStructuredKeywords, ["부드러움", "친근함"], "structured Vision keywords");

const unavailableKeywords = buildFaceLabLaunchData({
  structured: {
    mood: {
      status: "available",
      source: "fallback",
      evidence: ["not vision evidence"],
      value: { primary: "부드러움", traits: ["부드러움"] }
    }
  }
}).paid.faceMood.keywords;

assertEqual(unavailableKeywords, [], "case 5: fallback source is excluded");
assertEqual(
  buildFaceLabLaunchData({
    structured: {
      mood: {
        status: "available",
        source: "vision",
        evidence: [],
        value: { primary: "부드러움", traits: ["부드러움"] }
      }
    }
  }).paid.faceMood.keywords,
  [],
  "case 5: evidence-free values are excluded"
);
assertEqual(
  buildFaceLabLaunchData({ mood: { traits: ["부드러움"] } }).paid.faceMood.keywords,
  [],
  "case 7: legacy flat values are not promoted"
);
assertEqual(
  getAvailableVisionFaceLabData({
    status: "unavailable",
    source: null,
    data: { structured: { mood: { status: "available", value: { traits: ["부드러움"] } } } }
  }),
  null,
  "case 8: unavailable envelope is excluded"
);

console.log("Face Lab keyword summary contract checks passed.");
