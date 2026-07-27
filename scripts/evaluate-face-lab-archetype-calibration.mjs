import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const PRIVATE_ROOT = path.resolve(process.cwd(), "private", "face-lab-calibration");
const OUTPUT_ROOT = path.resolve(process.cwd(), "tmp", "face-lab-archetype-calibration");

function loadModule(filePath, names, dependencies = {}) {
  const source = readFileSync(filePath, "utf8")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\r?\n/gm, "")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
  const dependencyNames = Object.keys(dependencies);
  return Function(
    ...dependencyNames,
    `${source}\nreturn { ${names.join(", ")} };`
  )(...dependencyNames.map((name) => dependencies[name]));
}

function loadCalibrationEvaluator() {
  const observationModule = loadModule(
    "lib/face-lab-observation-contract.js",
    ["FACE_LAB_OBSERVATION_DEFINITIONS"]
  );
  const registryModule = loadModule(
    "lib/face-lab-archetype-registry.js",
    ["FACE_LAB_ARCHETYPE_REGISTRY"],
    { FACE_LAB_OBSERVATION_DEFINITIONS: observationModule.FACE_LAB_OBSERVATION_DEFINITIONS }
  );
  return loadModule(
    "lib/face-lab-archetype-calibration.js",
    ["evaluateFaceLabArchetypeCalibration"],
    { FACE_LAB_ARCHETYPE_REGISTRY: registryModule.FACE_LAB_ARCHETYPE_REGISTRY }
  ).evaluateFaceLabArchetypeCalibration;
}

function parseArgs(argv) {
  const args = {
    dataset: null,
    policies: null,
    split: "validation",
    output: null,
    allowHoldout: false,
    confirm: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--allow-holdout") {
      args.allowHoldout = true;
      continue;
    }
    if (!["--dataset", "--policies", "--split", "--output", "--confirm"].includes(token)) {
      throw new Error(`unknown argument: ${token}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${token} requires a value`);
    index += 1;
    args[token.slice(2)] = value;
  }
  if (!args.dataset || !args.policies || !args.output) {
    throw new Error("--dataset, --policies, and --output are required");
  }
  if (args.split === "holdout" && (!args.allowHoldout || args.confirm !== "HOLDOUT")) {
    throw new Error("holdout evaluation requires --allow-holdout --confirm HOLDOUT");
  }
  return args;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveInput(value, label) {
  if (!existsSync(PRIVATE_ROOT)) throw new Error("private calibration root does not exist");
  const rootResolved = path.resolve(PRIVATE_ROOT);
  const rootReal = realpathSync(PRIVATE_ROOT);
  const resolved = path.resolve(process.cwd(), value);
  if (!isInside(rootResolved, resolved)) {
    throw new Error(`${label} must stay under private/face-lab-calibration/`);
  }
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    throw new Error(`${label} must point to an existing regular file`);
  }
  const fileReal = realpathSync(resolved);
  if (!isInside(rootReal, fileReal)) {
    throw new Error(`${label} must stay under private/face-lab-calibration/`);
  }
  if (statSync(fileReal).size > MAX_INPUT_BYTES) {
    throw new Error(`${label} exceeds the 2 MiB limit`);
  }
  return fileReal;
}

function resolveOutput(value) {
  mkdirSync(OUTPUT_ROOT, { recursive: true });
  const rootReal = realpathSync(OUTPUT_ROOT);
  const resolved = path.resolve(process.cwd(), value);
  if (path.dirname(resolved) !== OUTPUT_ROOT || path.extname(resolved).toLowerCase() !== ".json") {
    throw new Error("output must be a direct .json file under tmp/face-lab-archetype-calibration/");
  }
  const outputPath = path.join(rootReal, path.basename(resolved));
  if (existsSync(outputPath)) throw new Error("output already exists; use a new output path");
  return outputPath;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(`${label} must contain valid JSON`);
  }
}

function classifyFailure(error) {
  const message = String(error?.message || "");
  if (message.includes("holdout evaluation requires")) return "holdout_confirmation_required";
  if (message.includes("must stay under") || message.includes("output must be")) return "path_boundary_rejected";
  if (message.includes("already exists")) return "output_exists";
  if (message.includes("valid JSON") || message.includes("schemaVersion") || message.includes("dataset") || message.includes("policy")) {
    return "calibration_input_invalid";
  }
  if (message.includes("required") || message.includes("unknown argument")) return "arguments_invalid";
  return "calibration_evaluation_failed";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const datasetPath = resolveInput(args.dataset, "dataset");
  const policyPath = resolveInput(args.policies, "policies");
  const outputPath = resolveOutput(args.output);
  const evaluateFaceLabArchetypeCalibration = loadCalibrationEvaluator();
  const report = evaluateFaceLabArchetypeCalibration({
    dataset: readJson(datasetPath, "dataset"),
    policySet: readJson(policyPath, "policies"),
    split: args.split,
    allowHoldout: args.allowHoldout
  });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log("[face-lab-archetype-calibration] COMPLETE", {
    split: report.evaluatedSplit,
    sampleCount: report.sampleCount,
    policyCount: report.policyResults.length,
    output: path.relative(process.cwd(), outputPath).replace(/\\/g, "/")
  });
}

try {
  main();
} catch (error) {
  console.error(`[face-lab-archetype-calibration] failed=${classifyFailure(error)}`);
  process.exitCode = 1;
}
