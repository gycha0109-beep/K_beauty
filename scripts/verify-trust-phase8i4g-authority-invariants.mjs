import fs from "node:fs";
import {
  verifyCanaryProtectedAuthorityInvariant,
} from "../lib/trust/official-source-grouped-relocation-canary.mjs";

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const beforePath = argValue("before");
const afterPath = argValue("after");
if (!beforePath || !afterPath) {
  throw new Error(
    "Usage: node scripts/verify-trust-phase8i4g-authority-invariants.mjs --before=<json> --after=<json>",
  );
}
const result = verifyCanaryProtectedAuthorityInvariant(
  JSON.parse(fs.readFileSync(beforePath, "utf8")),
  JSON.parse(fs.readFileSync(afterPath, "utf8")),
);
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (result.result !== "PASS") process.exitCode = 1;
