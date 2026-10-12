import path from "node:path";
import { scanPackageTree, TARGET_PACKAGES } from "./supply-chain-call-site-scanner.mjs";

// Read-only scan of installed dependency source; source-code pattern matching
// does not establish execution reachability, exploitability, or remediation.
const reports = TARGET_PACKAGES.map((name) => {
  const packageRoot = path.resolve("node_modules", ...name.split("/"));
  return scanPackageTree(packageRoot, name);
});
for (const report of reports) {
  console.log("SUPPLY_CHAIN_CALL_SITE_OBSERVATION=" + JSON.stringify(report));
}
const absent = reports.filter((r) => !r.exists).map((r) => r.package);
const incomplete = reports.filter((r) => r.incomplete).map((r) => r.package);
console.log("SUPPLY_CHAIN_CALL_SITE_SUMMARY=" + JSON.stringify({
  packageCount: reports.length,
  absent,
  incomplete,
  interpretation: "Any missing marker is UNKNOWN; no bypass of npm audit; exact installed-code call-site inventory only",
}));
