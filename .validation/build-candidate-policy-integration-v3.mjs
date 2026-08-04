import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const V2 = process.env.AMENDED_BUILDER_PATH;
const mode = process.argv[2] || "build";

if (!V2 || !existsSync(V2)) throw new Error("AMENDED_BUILDER_PATH is required");

function runV2(nextMode) {
  execFileSync(process.execPath, [V2, nextMode], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024
  });
}

if (mode === "build") {
  runV2("build");
  const verifierPath = path.join(ROOT, "scripts/verify-candidate-policy-main-integration.mjs");
  let text = readFileSync(verifierPath, "utf8");
  const oldLine = 'check(!route.includes("/api/internal/candidate-exposure-policy-diagnostic"), "temporary diagnostic route token leaked");';
  const replacement = 'const diagnosticRouteToken = ["/api/internal", "candidate-exposure-policy-diagnostic"].join("/");\ncheck(!route.includes(diagnosticRouteToken), "temporary diagnostic route token leaked");';
  if (!text.includes(oldLine)) throw new Error("integration verifier route-token marker missing");
  text = text.replace(oldLine, replacement);
  writeFileSync(verifierPath, text, "utf8");
  console.log("integration verifier route-token self-match removed");
} else if (mode === "manifest") {
  runV2("manifest");
} else {
  throw new Error(`unknown mode: ${mode}`);
}
