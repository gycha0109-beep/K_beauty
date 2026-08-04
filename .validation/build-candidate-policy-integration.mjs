import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAIN = "647051f7feff8e23dc7b563cb7b58ffcba7e6eaf";
const SOURCE = "ce882aa2057a06d39d86f99a09f4264725b4161b";
const DESIGN = "797e179077df9065f08a262c92f4940f5a259cbe";
const MANIFEST_PATH = "docs/architecture/candidate-policy-main-integration-blob-manifest-v1.json";

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: options.encoding === null ? null : "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
}

function gitText(...args) {
  return git(args).trim();
}

function showText(ref, filePath) {
  return git(["show", `${ref}:${filePath}`]);
}

function linesFromRef(ref, filePath) {
  return showText(ref, filePath)
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`missing semantic marker: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`non-unique semantic marker: ${label}`);
  }
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function writeText(filePath, content) {
  mkdirSync(path.dirname(path.join(ROOT, filePath)), { recursive: true });
  writeFileSync(path.join(ROOT, filePath), content, "utf8");
}

function hashWorking(filePath) {
  return gitText("hash-object", "--", filePath);
}

function blobAt(ref, filePath) {
  return gitText("rev-parse", `${ref}:${filePath}`);
}

function patchAnalyzeRoute() {
  const filePath = "app/api/analyze/route.js";
  let text = readFileSync(filePath, "utf8");

  text = replaceOnce(
    text,
    'import { rebuildPremiumDecisionState } from "@/lib/premium-decision-state";\n',
    'import { rebuildPremiumDecisionState } from "@/lib/premium-decision-state";\nimport {\n  resolveCandidateExposurePolicyShadowControl,\n  runCandidateExposurePolicyShadow\n} from "@/lib/candidate-exposure-policy-shadow";\n',
    "analyze shadow import"
  );

  text = replaceOnce(
    text,
    '    const evaluatorBoundaryPolicyShadowEnabled =\n      process.env.NODE_ENV === "development" &&\n      process.env.DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN === "1" &&\n      process.env.DEV_ONLY_BOUNDARY_POLICY_SHADOW === "1" &&\n      localShadowProviderStub.enabled;\n',
    '    const evaluatorBoundaryPolicyShadowEnabled =\n      process.env.NODE_ENV === "development" &&\n      process.env.DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN === "1" &&\n      process.env.DEV_ONLY_BOUNDARY_POLICY_SHADOW === "1" &&\n      localShadowProviderStub.enabled;\n    const candidateExposurePolicyShadowControl =\n      resolveCandidateExposurePolicyShadowControl(process.env);\n',
    "analyze shadow control"
  );

  text = replaceOnce(
    text,
    '      includeCandidateSourceDiagnostics: functionalShadowCaptureEnabled || evaluatorBoundaryPolicyShadowEnabled || localActualRuntimeEvidenceEnabled,\n      includeEvaluatorBoundaryPolicyShadow: evaluatorBoundaryPolicyShadowEnabled\n',
    '      includeCandidateSourceDiagnostics:\n        functionalShadowCaptureEnabled ||\n        evaluatorBoundaryPolicyShadowEnabled ||\n        localActualRuntimeEvidenceEnabled ||\n        candidateExposurePolicyShadowControl.enabled,\n      includeEvaluatorBoundaryPolicyShadow:\n        evaluatorBoundaryPolicyShadowEnabled ||\n        candidateExposurePolicyShadowControl.enabled\n',
    "analyze diagnostic inclusion"
  );

  text = replaceOnce(
    text,
    '    const rebuiltPremiumReport = premiumDecisionSource\n      ? rebuildPremiumDecisionState(premiumDecisionSource, {\n          locale,\n          source: "api_analyze_initial_session"\n        })\n      : null;\n',
    '    const rebuiltPremiumReport = premiumDecisionSource\n      ? rebuildPremiumDecisionState(premiumDecisionSource, {\n          locale,\n          source: "api_analyze_initial_session"\n        })\n      : null;\n    if (candidateExposurePolicyShadowControl.enabled && rebuiltPremiumReport) {\n      runCandidateExposurePolicyShadow({\n        control: candidateExposurePolicyShadowControl,\n        canonicalState: rebuiltPremiumReport,\n        candidates: decision?.diagnostics?.candidateSource?.products || [],\n        legacyExecution: decision?.diagnostics?.evaluatorBoundaryPolicyShadow || null,\n        responseValue: publicDecision,\n        snapshotValue: rebuiltPremiumReport\n      });\n    }\n',
    "analyze post-canonical shadow invocation"
  );

  if (!text.includes('    const { access: premiumAccess } = await resolvePremiumAccessForRequest(request);')) {
    throw new Error("current-main premium access ownership marker changed");
  }
  if (text.includes("userId: premiumUser?.id")) {
    throw new Error("source-only premium ownership change leaked into analyze route");
  }

  writeText(filePath, text);
}

function patchEvaluatorBoundary() {
  const filePath = "lib/evaluator-boundary-policy-shadow.js";
  let text = readFileSync(filePath, "utf8");
  text = replaceOnce(
    text,
    '      receiverDecision: receiverResult.receiverDecision,\n      futureExposureGroup: receiverResult.futureExposureGroup,\n',
    '      receiverDecision: receiverResult.receiverDecision,\n      baselineExposureGroup: currentExposureDecision.exposureStatus,\n      futureExposureGroup: receiverResult.futureExposureGroup,\n',
    "baseline exposure observability"
  );
  writeText(filePath, text);
}

function patchPackageJson() {
  const filePath = "package.json";
  const pkg = JSON.parse(readFileSync(filePath, "utf8"));
  const scripts = pkg.scripts || {};
  const orderedScripts = {};
  for (const key of ["dev", "build", "start"]) {
    if (key in scripts) orderedScripts[key] = scripts[key];
  }
  orderedScripts["verify:candidate-exposure-policy-shadow"] =
    "node scripts/verify-candidate-exposure-policy-shadow-runtime.mjs";
  orderedScripts["verify:candidate-exposure-policy-shadow-evaluation"] =
    "node scripts/verify-candidate-exposure-policy-shadow-evaluation.mjs";
  for (const [key, value] of Object.entries(scripts)) {
    if (!(key in orderedScripts)) orderedScripts[key] = value;
  }
  pkg.scripts = orderedScripts;
  pkg.devDependencies = {
    ...(pkg.devDependencies || {}),
    postcss: "^8.5.25"
  };
  pkg.overrides = {
    next: {
      postcss: "8.5.25",
      sharp: "0.35.3"
    }
  };
  writeText(filePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function patchSecuritySuite() {
  const filePath = "scripts/run-security-closeout-verifier-suite.mjs";
  let text = readFileSync(filePath, "utf8");
  text = replaceOnce(
    text,
    '  "verify-anonymous-write-grant-v2.mjs",\n  "verify-candidate-policy-hint-receiver-design.mjs",\n',
    '  "verify-anonymous-write-grant-v2.mjs",\n  "verify-candidate-exposure-policy-diagnostic-route-absence.mjs",\n  "verify-candidate-exposure-policy-shadow-evaluation.mjs",\n  "verify-candidate-exposure-policy-shadow-runtime.mjs",\n  "verify-candidate-policy-hint-receiver-design.mjs",\n  "verify-candidate-policy-main-integration.mjs",\n  "verify-candidate-policy-runtime-reevaluation.mjs",\n',
    "security candidate verifier union"
  );
  writeText(filePath, text);
}

function patchReadinessVerifier() {
  const filePath = "scripts/verify-evaluator-boundary-readiness-review.mjs";
  let text = readFileSync(filePath, "utf8");
  text = replaceOnce(
    text,
    '    assert.equal(output.readinessStatus, "blocked_by_source_unavailability");\n',
    '    assert.equal(\n      output.readinessStatus,\n      output.pureReplayEvidenceSummary.productRowsLoaded > 0\n        ? "needs_more_evidence_before_design"\n        : "blocked_by_source_unavailability"\n    );\n',
    "pure replay aware source classification"
  );
  writeText(filePath, text);
}

const verifierSource = `import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "docs/architecture/candidate-policy-main-integration-blob-manifest-v1.json");
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
let assertions = 0;
const check = (value, message) => { assertions += 1; assert.ok(value, message); };
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const hash = (filePath) => git("hash-object", "--", filePath);

check(manifest.version === "candidate-policy-main-integration-blob-manifest-v1", "manifest version drift");
check(manifest.baseSha === "647051f7feff8e23dc7b563cb7b58ffcba7e6eaf", "main authority drift");
check(manifest.sourceSha === "ce882aa2057a06d39d86f99a09f4264725b4161b", "source authority drift");
check(manifest.counts.includeExact === 62, "include exact count drift");
check(manifest.counts.mergeSemantic === 6, "semantic count drift");
check(manifest.counts.excludeSourceOnly === 38, "source-only exclusion count drift");
check(manifest.counts.preserveMain === 302, "main preservation count drift");

for (const entry of manifest.includeExact) {
  check(existsSync(path.join(ROOT, entry.path)), \`missing exact source path: \${entry.path}\`);
  check(hash(entry.path) === entry.sourceBlob, \`source blob mismatch: \${entry.path}\`);
}
for (const entry of manifest.preserveMain) {
  check(existsSync(path.join(ROOT, entry.path)), \`missing current-main path: \${entry.path}\`);
  check(hash(entry.path) === entry.mainBlob, \`current-main blob mismatch: \${entry.path}\`);
}
for (const entry of manifest.excludeSourceOnly) {
  check(!existsSync(path.join(ROOT, entry.path)), \`excluded source-only path present: \${entry.path}\`);
}
for (const entry of manifest.mergeSemantic) {
  check(existsSync(path.join(ROOT, entry.path)), \`missing semantic path: \${entry.path}\`);
  check(hash(entry.path) === entry.resultBlob, \`semantic result blob mismatch: \${entry.path}\`);
}
for (const filePath of manifest.temporaryRouteFiles) {
  check(!existsSync(path.join(ROOT, filePath)), \`temporary diagnostic route residue: \${filePath}\`);
}

const route = readFileSync(path.join(ROOT, "app/api/analyze/route.js"), "utf8");
for (const token of [
  "resolveCandidateExposurePolicyShadowControl",
  "runCandidateExposurePolicyShadow",
  "candidateExposurePolicyShadowControl.enabled",
  "canonicalState: rebuiltPremiumReport",
  "responseValue: publicDecision",
  "snapshotValue: rebuiltPremiumReport"
]) check(route.includes(token), \`missing analyze semantic token: \${token}\`);
check(route.includes("const { access: premiumAccess } = await resolvePremiumAccessForRequest(request);"), "main premium access contract changed");
check(!route.includes("userId: premiumUser?.id"), "source-only premium ownership leaked");
check(!route.includes("/api/internal/candidate-exposure-policy-diagnostic"), "temporary diagnostic route token leaked");

const evaluator = readFileSync(path.join(ROOT, "lib/evaluator-boundary-policy-shadow.js"), "utf8");
check(evaluator.includes("baselineExposureGroup: currentExposureDecision.exposureStatus"), "baseline exposure field missing");

const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
check(Array.isArray(pkg.workspaces) && pkg.workspaces.includes("packages/*") && pkg.workspaces.includes("tools/*"), "workspace contract lost");
check(pkg.scripts["verify:candidate-exposure-policy-shadow"], "shadow script missing");
check(pkg.scripts["verify:candidate-exposure-policy-shadow-evaluation"], "shadow evaluation script missing");
check(pkg.scripts["synthetic:test"] && pkg.scripts["synthetic:solo"], "Toolkit scripts lost");
check(pkg.devDependencies.postcss === "^8.5.25", "postcss remediation drift");
check(pkg.overrides?.next?.postcss === "8.5.25", "Next postcss override drift");
check(pkg.overrides?.next?.sharp === "0.35.3", "Next sharp override drift");

const securitySuite = readFileSync(path.join(ROOT, "scripts/run-security-closeout-verifier-suite.mjs"), "utf8");
for (const verifier of manifest.preservedMainSecurityVerifiers) {
  check(securitySuite.includes(\`"\${verifier}"\`), \`main security verifier removed: \${verifier}\`);
}
for (const verifier of manifest.requiredCandidateSecurityVerifiers) {
  const occurrences = securitySuite.split(\`"\${verifier}"\`).length - 1;
  check(occurrences === 1, \`candidate security verifier count mismatch: \${verifier}\`);
  check(existsSync(path.join(ROOT, "scripts", verifier)), \`candidate verifier file missing: \${verifier}\`);
}

const readiness = readFileSync(path.join(ROOT, "scripts/verify-evaluator-boundary-readiness-review.mjs"), "utf8");
check(readiness.includes("output.pureReplayEvidenceSummary.productRowsLoaded > 0"), "readiness semantic delta missing");

const closurePaths = [...manifest.includeExact.map((entry) => entry.path), ...manifest.mergeSemantic.map((entry) => entry.path)]
  .filter((value) => /\\.(?:m?js|jsx)$/.test(value));
const candidates = (filePath) => [filePath, \`\${filePath}.js\`, \`\${filePath}.mjs\`, path.join(filePath, "index.js")];
const resolveImport = (owner, specifier) => {
  if (specifier.startsWith("@/")) return candidates(path.join(ROOT, specifier.slice(2))).some(existsSync);
  if (specifier.startsWith(".")) return candidates(path.resolve(ROOT, path.dirname(owner), specifier)).some(existsSync);
  return true;
};
for (const owner of closurePaths) {
  const content = readFileSync(path.join(ROOT, owner), "utf8");
  const specs = new Set();
  for (const regex of [/from\\s+["']([^"']+)["']/g, /import\\(\\s*["']([^"']+)["']\\s*\\)/g]) {
    for (const match of content.matchAll(regex)) specs.add(match[1]);
  }
  for (const specifier of specs) check(resolveImport(owner, specifier), \`unresolved import \${owner} -> \${specifier}\`);
}
for (const command of Object.values(pkg.scripts)) {
  const match = String(command).match(/(?:^|&&\\s*|;\\s*)node\\s+([^\\s]+)/);
  if (match && match[1].startsWith("scripts/")) check(existsSync(path.join(ROOT, match[1])), \`package script target missing: \${match[1]}\`);
}

console.log(\`verify-candidate-policy-main-integration: PASS (\${assertions} assertions; 62 exact, 6 semantic, 38 absent, 302 main preserved)\`);
`;

function writeVerifier() {
  writeText("scripts/verify-candidate-policy-main-integration.mjs", verifierSource);
}

function copyDesignAssets() {
  const paths = [
    "docs/architecture/candidate-policy-main-integration-exhaustiveness-audit-v1.md",
    "docs/architecture/candidate-policy-main-integration-final-design-v1.md",
    "docs/architecture/candidate-policy-main-integration-ledger/exclude-main-platform.txt",
    "docs/architecture/candidate-policy-main-integration-ledger/exclude-main-toolkit-docs.txt",
    "docs/architecture/candidate-policy-main-integration-ledger/exclude-main-toolkit-root-packages.txt",
    "docs/architecture/candidate-policy-main-integration-ledger/exclude-main-toolkit-src.txt",
    "docs/architecture/candidate-policy-main-integration-ledger/exclude-main-toolkit-tests.txt",
    "docs/architecture/candidate-policy-main-integration-ledger/exclude-source-only.txt",
    "docs/architecture/candidate-policy-main-integration-ledger/include-exact.txt",
    "docs/architecture/candidate-policy-main-integration-ledger/merge-semantic.txt",
    "docs/architecture/candidate-policy-main-integration-manifest-v1.json",
    "docs/architecture/candidate-policy-main-integration-path-ledger-v1.json"
  ];
  git(["checkout", DESIGN, "--", ...paths]);
}

function buildCandidate() {
  const includeExact = linesFromRef(DESIGN, "docs/architecture/candidate-policy-main-integration-ledger/include-exact.txt");
  const excludeSourceOnly = linesFromRef(DESIGN, "docs/architecture/candidate-policy-main-integration-ledger/exclude-source-only.txt");
  if (includeExact.length !== 62) throw new Error(`expected 62 exact paths, got ${includeExact.length}`);
  if (excludeSourceOnly.length !== 38) throw new Error(`expected 38 source exclusions, got ${excludeSourceOnly.length}`);

  git(["checkout", SOURCE, "--", ...includeExact]);
  for (const filePath of excludeSourceOnly) rmSync(path.join(ROOT, filePath), { recursive: true, force: true });
  copyDesignAssets();
  patchAnalyzeRoute();
  patchEvaluatorBoundary();
  patchPackageJson();
  patchSecuritySuite();
  patchReadinessVerifier();
  writeVerifier();
  console.log("candidate tree materialized");
}

function parseExpectedVerifiers(text) {
  const start = text.indexOf("const EXPECTED_VERIFIERS = [");
  const end = text.indexOf("];", start);
  if (start < 0 || end < 0) throw new Error("unable to parse main security verifier manifest");
  return [...text.slice(start, end).matchAll(/"([^"]+\.mjs)"/g)].map((match) => match[1]);
}

function writeManifest() {
  const includeExact = linesFromRef(DESIGN, "docs/architecture/candidate-policy-main-integration-ledger/include-exact.txt");
  const excludeSourceOnly = linesFromRef(DESIGN, "docs/architecture/candidate-policy-main-integration-ledger/exclude-source-only.txt");
  const preserveMainFiles = [
    "docs/architecture/candidate-policy-main-integration-ledger/exclude-main-platform.txt",
    "docs/architecture/candidate-policy-main-integration-ledger/exclude-main-toolkit-docs.txt",
    "docs/architecture/candidate-policy-main-integration-ledger/exclude-main-toolkit-root-packages.txt",
    "docs/architecture/candidate-policy-main-integration-ledger/exclude-main-toolkit-src.txt",
    "docs/architecture/candidate-policy-main-integration-ledger/exclude-main-toolkit-tests.txt"
  ];
  const preserveMain = preserveMainFiles.flatMap((filePath) => linesFromRef(DESIGN, filePath));
  const mergeSemantic = linesFromRef(DESIGN, "docs/architecture/candidate-policy-main-integration-ledger/merge-semantic.txt");
  if (preserveMain.length !== 302) throw new Error(`expected 302 main-preserve paths, got ${preserveMain.length}`);
  if (mergeSemantic.length !== 6) throw new Error(`expected 6 semantic paths, got ${mergeSemantic.length}`);

  const mainSecurity = showText(MAIN, "scripts/run-security-closeout-verifier-suite.mjs");
  const manifest = {
    version: "candidate-policy-main-integration-blob-manifest-v1",
    baseSha: MAIN,
    sourceSha: SOURCE,
    designSha: DESIGN,
    counts: {
      includeExact: includeExact.length,
      mergeSemantic: mergeSemantic.length,
      excludeSourceOnly: excludeSourceOnly.length,
      preserveMain: preserveMain.length,
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
  console.log(`blob manifest written: ${MANIFEST_PATH}`);
}

const mode = process.argv[2] || "build";
if (mode === "build") buildCandidate();
else if (mode === "manifest") writeManifest();
else throw new Error(`unknown mode: ${mode}`);
