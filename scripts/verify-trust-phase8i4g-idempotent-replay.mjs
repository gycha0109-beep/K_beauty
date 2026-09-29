import fs from "node:fs";
import {
  verifyCanaryIdempotentReplay,
} from "../lib/trust/official-source-grouped-relocation-canary.mjs";

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const firstPath = argValue("first");
const replayPath = argValue("replay");
const beforePath = argValue("before-replay");
const afterPath = argValue("after-replay");
if (!firstPath || !replayPath || !beforePath || !afterPath) {
  throw new Error(
    "Usage: node scripts/verify-trust-phase8i4g-idempotent-replay.mjs --first=<json> --replay=<json> --before-replay=<json> --after-replay=<json>",
  );
}
const result = verifyCanaryIdempotentReplay({
  firstResult: JSON.parse(fs.readFileSync(firstPath, "utf8")),
  replayResult: JSON.parse(fs.readFileSync(replayPath, "utf8")),
  beforeReplay: JSON.parse(fs.readFileSync(beforePath, "utf8")),
  afterReplay: JSON.parse(fs.readFileSync(afterPath, "utf8")),
});
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (result.result !== "PASS") process.exitCode = 1;
