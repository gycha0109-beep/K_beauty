import fs from "node:fs";
import {
  verifyCanaryGroupedLineage,
} from "../lib/trust/official-source-grouped-relocation-canary.mjs";

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const expectedPath = argValue("expected");
const lineagePath = argValue("lineage");
if (!expectedPath || !lineagePath) {
  throw new Error(
    "Usage: node scripts/verify-trust-phase8i4g-lineage.mjs --expected=<json> --lineage=<json>",
  );
}
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const actual = JSON.parse(fs.readFileSync(lineagePath, "utf8"));
const result = verifyCanaryGroupedLineage({
  expectedSourceIds:
    expected.historical_source_ids ?? expected.historicalSourceIds,
  expectedIncidentIds: expected.incident_ids ?? expected.incidentIds,
  lineage: actual,
});
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (result.result !== "PASS") process.exitCode = 1;
