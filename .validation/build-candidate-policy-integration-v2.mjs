import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAIN = "647051f7feff8e23dc7b563cb7b58ffcba7e6eaf";
const SOURCE = "ce882aa2057a06d39d86f99a09f4264725b4161b";
const DESIGN = "797e179077df9065f08a262c92f4940f5a259cbe";
const ROUTE_ABSENCE = "scripts/verify-candidate-exposure-policy-diagnostic-route-absence.mjs";
const MANIFEST_PATH = "docs/architecture/candidate-policy-main-integration-blob-manifest-v1.json";
const ORIGINAL = process.env.ORIGINAL_BUILDER_PATH;

function exec(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options
  });
}

function git(...args) {
  return exec("git", args).trim();
}

function writeText(filePath, content) {
  mkdirSync(path.dirname(path.join(ROOT, filePath)), { recursive: true });
  writeFileSync(path.join(ROOT, filePath), content, "utf8");
}

function readLines(filePath) {
  return readFileSync(path.join(ROOT, filePath), "utf8")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function showText(ref, filePath) {
  return exec("git", ["show", `${ref}:${filePath}`]);
}

function blobAt(ref, filePath) {
  return git("rev-parse", `${ref}:${filePath}`);
}

function hashWorking(filePath) {
  return git("hash-object", "--", filePath);
}

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`missing patch marker: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`non-unique patch marker: ${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function patchRouteAbsenceVerifier() {
  let text = readFileSync(path.join(ROOT, ROUTE_ABSENCE), "utf8");
  text = replaceOnce(
    text,
    '  "scripts/check-candidate-exposure-policy-hosted-execution.mjs":\n    "24baea33e998a9285ddbc65ffda54500a9d4c061",\n  "app/api/analyze/route.js":\n    "3e6710c33791972772835ac6583877f81b5b0671"\n',
    '  "scripts/check-candidate-exposure-policy-hosted-execution.mjs":\n    "24baea33e998a9285ddbc65ffda54500a9d4c061"\n',
    "remove obsolete analyze exact blob"
  );
  text = replaceOnce(
    text,
    'const adapterSource = readFileSync(\n',
    `const analyzeSource = readFileSync(\n  path.join(ROOT, "app/api/analyze/route.js"),\n  "utf8"\n);\nfor (const token of [\n  "resolveCandidateExposurePolicyShadowControl",\n  "runCandidateExposurePolicyShadow",\n  "candidateExposurePolicyShadowControl.enabled",\n  "canonicalState: rebuiltPremiumReport",\n  "responseValue: publicDecision",\n  "snapshotValue: rebuiltPremiumReport"\n]) {\n  assert(analyzeSource.includes(token), \`approved_analyze_semantic_present:\${token}\`);\n}\nassert(\n  analyzeSource.includes("const { access: premiumAccess } = await resolvePremiumAccessForRequest(request);"),\n  "current_main_premium_access_preserved"\n);\nassert(\n  !analyzeSource.includes("userId: premiumUser?.id"),\n  "source_only_premium_ownership_absent"\n);\n\nconst adapterSource = readFileSync(\n`,
    "add integration-aware analyze assertions"
  );
  writeText(ROUTE_ABSENCE, text);
}

function amendDispositionAssets() {
  const includePath = "docs/architecture/candidate-policy-main-integration-ledger/include-exact.txt";
  const semanticPath = "docs/architecture/candidate-policy-main-integration-ledger/merge-semantic.txt";
  const include = readLines(includePath).filter((value) => value !== ROUTE_ABSENCE);
  const semantic = [...new Set([...readLines(semanticPath), ROUTE_ABSENCE])].sort();
  if (include.length !== 61) throw new Error(`expected 61 exact paths after amendment, got ${include.length}`);
  if (semantic.length !== 7) throw new Error(`expected 7 semantic paths after amendment, got ${semantic.length}`);
  writeText(includePath, `${include.join("\n")}\n`);
  writeText(semanticPath, `${semantic.join("\n")}\n`);

  const ledgerPath = "docs/architecture/candidate-policy-main-integration-path-ledger-v1.json";
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  ledger.status = "exhaustive_tree_diff_408_classified_implementation_amended";
  ledger.counts.includeExact = 61;
  ledger.counts.mergeSemantic = 7;
  ledger.semanticContracts[ROUTE_ABSENCE] = {
    sourceAuthority: ["temporary path absence", "forbidden runtime token scan", "hosted execution remains blocked"],
    integrationAuthority: ["approved analyze semantic contract", "current-main Premium access preservation"],
    prohibited: ["obsolete analyze exact-blob assertion", "weakened route absence", "temporary diagnostic route"]
  };
  ledger.implementationAmendment = {
    reason: "route absence verifier contained an obsolete exact blob assertion for a separately approved semantic merge path",
    previousDisposition: "includeExact",
    finalDisposition: "mergeSemantic",
    path: ROUTE_ABSENCE,
    totalPathCountChanged: false
  };
  writeText(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);

  const designManifestPath = "docs/architecture/candidate-policy-main-integration-manifest-v1.json";
  const designManifest = JSON.parse(readFileSync(designManifestPath, "utf8"));
  designManifest.status = "final_design_complete_exhaustive_path_ledger_implementation_amended";
  designManifest.authoritativeTreeComparison.dispositionCounts.include_exact = 61;
  designManifest.authoritativeTreeComparison.dispositionCounts.merge_semantic = 7;
  designManifest.semanticMergePaths.push({
    path: ROUTE_ABSENCE,
    resolution: "preserve route absence and forbidden-token checks while replacing obsolete analyze exact-blob assertion with approved semantic contract checks"
  });
  designManifest.implementationAmendment = ledger.implementationAmendment;
  designManifest.machineStatus = "ready_for_single_pr_implementation_after_exhaustive_408_path_audit_and_verifier_amendment";
  writeText(designManifestPath, `${JSON.stringify(designManifest, null, 2)}\n`);

  const amendment = `\n---\n\n## Implementation disposition amendment\n\n\`scripts/verify-candidate-exposure-policy-diagnostic-route-absence.mjs\` moved from exact-source to semantic integration because its source version hard-coded the pre-integration \`app/api/analyze/route.js\` blob. The final verifier retains every temporary-path and forbidden-token check and adds explicit checks for the approved current-main semantic route contract.\n\n\`61 exact + 7 semantic + 38 source-only absent + 302 main-preserved = 408\`.\n`;
  for (const docPath of [
    "docs/architecture/candidate-policy-main-integration-final-design-v1.md",
    "docs/architecture/candidate-policy-main-integration-exhaustiveness-audit-v1.md"
  ]) {
    writeText(docPath, `${readFileSync(docPath, "utf8").trimEnd()}${amendment}`);
  }
}

function patchGeneratedIntegrationVerifier() {
  const filePath = "scripts/verify-candidate-policy-main-integration.mjs";
  let text = readFileSync(filePath, "utf8");
  text = text
    .replace('manifest.counts.includeExact === 62', 'manifest.counts.includeExact === 61')
    .replace('manifest.counts.mergeSemantic === 6', 'manifest.counts.mergeSemantic === 7')
    .replace('62 exact, 6 semantic, 38 absent, 302 main preserved', '61 exact, 7 semantic, 38 absent, 302 main preserved');
  writeText(filePath, text);
}

function parseExpectedVerifiers(text) {
  const start = text.indexOf("const EXPECTED_VERIFIERS = [");
  const end = text.indexOf("];", start);
  if (start < 0 || end < 0) throw new Error("unable to parse main security verifier manifest");
  return [...text.slice(start, end).matchAll(/"([^"]+\.mjs)"/g)].map((match) => match[1]);
}

function writeManifest() {
  const includeExact = readLines("docs/architecture/candidate-policy-main-integration-ledger/include-exact.txt");
  const mergeSemantic = readLines("docs/architecture/candidate-policy-main-integration-ledger/merge-semantic.txt");
  const excludeSourceOnly = readLines("docs/architecture/candidate-policy-main-integration-ledger/exclude-source-only.txt");
  const preserveMain = [
    "exclude-main-platform.txt",
    "exclude-main-toolkit-docs.txt",
    "exclude-main-toolkit-root-packages.txt",
    "exclude-main-toolkit-src.txt",
    "exclude-main-toolkit-tests.txt"
  ].flatMap((name) => readLines(`docs/architecture/candidate-policy-main-integration-ledger/${name}`));
  if (includeExact.length !== 61 || mergeSemantic.length !== 7 || excludeSourceOnly.length !== 38 || preserveMain.length !== 302) {
    throw new Error("amended disposition counts are invalid");
  }
  const mainSecurity = showText(MAIN, "scripts/run-security-closeout-verifier-suite.mjs");
  const manifest = {
    version: "candidate-policy-main-integration-blob-manifest-v1",
    baseSha: MAIN,
    sourceSha: SOURCE,
    designSha: DESIGN,
    counts: {
      includeExact: 61,
      mergeSemantic: 7,
      excludeSourceOnly: 38,
      preserveMain: 302,
      authoritativeTreeDiff: 408
    },
    includeExact: includeExact.map((filePath) => ({ path: filePath, sourceBlob: blobAt(SOURCE, filePath) })),
    mergeSemantic: mergeSemantic.map((filePath) => ({ path: filePath, resultBlob: hashWorking(filePath) })),
    excludeSourceOnly: excludeSourceOnly.map((filePath) => ({ path: filePath })),
    preserveMain: preserveMain.map((filePath) => ({ path: filePath, mainBlob: blobAt(MAIN, filePath) })),
    temporaryRouteFiles: [
      "app/api/internal/candidate-exposure-policy-diagnostic/route.js",
      "lib/candidate-exposure-policy-hosted-diagnostic-auth.js",
      "lib/candidate-exposure-policy-hosted-diagnostic-contract.js",
      "lib/candidate-exposure-policy-hosted-diagnostic-execution.js",
      "scripts/check-candidate-exposure-policy-hosted-diagnostic-route.mjs"
    ],
    preservedMainSecurityVerifiers: parseExpectedVerifiers(mainSecurity),
    requiredCandidateSecurityVerifiers: [
      "verify-candidate-exposure-policy-diagnostic-route-absence.mjs",
      "verify-candidate-exposure-policy-shadow-evaluation.mjs",
      "verify-candidate-exposure-policy-shadow-runtime.mjs",
      "verify-candidate-policy-main-integration.mjs",
      "verify-candidate-policy-runtime-reevaluation.mjs"
    ],
    implementationAmendment: {
      path: ROUTE_ABSENCE,
      from: "includeExact",
      to: "mergeSemantic",
      reason: "obsolete exact blob assertion conflicted with approved analyze semantic merge"
    },
    runtimeInvariants: {
      defaultOff: true,
      productionHardDisabled: true,
      recommendationMutation: false,
      responseMutation: false,
      databaseMutation: false,
      productionMutation: false
    }
  };
  writeText(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`amended blob manifest written: ${MANIFEST_PATH}`);
}

const mode = process.argv[2] || "build";
if (!ORIGINAL || !existsSync(ORIGINAL)) throw new Error("ORIGINAL_BUILDER_PATH is required");
if (mode === "build") {
  exec(process.execPath, [ORIGINAL, "build"], { stdio: "inherit" });
  patchRouteAbsenceVerifier();
  amendDispositionAssets();
  patchGeneratedIntegrationVerifier();
  console.log("integration-aware verifier amendment applied");
} else if (mode === "manifest") {
  writeManifest();
} else {
  throw new Error(`unknown mode: ${mode}`);
}
