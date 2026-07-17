import { readFile } from "node:fs/promises";
import { deleteSavedReportById, fetchAuthUser, hashIdentifier, requireCondition } from "./premium-browser-journey-core.mjs";
import { HOSTED_FAILURE_CATEGORIES, loadHostedManifest, parseHostedConfig } from "./premium-hosted-preview-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);
const evidencePath = String(process.env.PREMIUM_HOSTED_CLEANUP_EVIDENCE_PATH || "").trim();
const confirmation = String(process.env.PREMIUM_HOSTED_CLEANUP_CONFIRMATION || "").trim();
const accessToken = String(process.env.PREMIUM_HOSTED_ACCESS_TOKEN || "").trim();
const supabaseUrl = String(process.env.PREMIUM_HOSTED_SUPABASE_URL || "").trim();
const anonKey = String(process.env.PREMIUM_HOSTED_SUPABASE_ANON_KEY || "").trim();

requireCondition(confirmation === `DELETE_HOSTED_TEST_ROWS:${config.runId}`, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_not_confirmed");
requireCondition(evidencePath, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_evidence_missing");
const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
const ids = Array.isArray(evidence?.rows) ? evidence.rows.map((row) => row.savedReportId).filter(Boolean) : [];
requireCondition(ids.length > 0 && ids.length <= 20, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_scope_invalid");
const user = await fetchAuthUser({ accessToken, supabaseUrl, anonKey });
requireCondition(hashIdentifier(user.id) === manifest.accountA.expectedUserIdHash, HOSTED_FAILURE_CATEGORIES.AUTH, "cleanup", "cleanup_account_mismatch");

const deleted = [];
for (const id of ids) {
  const result = await deleteSavedReportById({ accessToken, supabaseUrl, anonKey }, id);
  requireCondition(result.length === 1 && result[0] === id, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "cleanup", "cleanup_delete_failed");
  deleted.push(id);
}
console.log(JSON.stringify({ status: "passed", deletedCount: deleted.length }, null, 2));
