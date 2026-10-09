export const FACE_LAB_MIGRATION_RECONCILER_VERSION =
  "face-lab-migration-reconciliation-offline-v1";

const FILE_RE = /^([0-9]{14})_([a-zA-Z0-9][a-zA-Z0-9._-]*)\.sql$/;
const VERSION_RE = /^[0-9]{14}$/;
const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,239}$/;
const SHA_RE = /^[a-f0-9]{64}$/;
const HIGH_RISK_RE = /(?:^|[_-])(face[_-]?lab|admin|auth|grant|permission|policy|rls|storage|security|privilege|jwt|role|secret|payment|revoke|audit)(?:[_-]|$)/i;

function fail(code) {
  throw new Error("migration_inventory_" + code);
}
function isPlain(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value);
}
function normalizeName(name) {
  return name.toLowerCase().replace(/[-.]+/g, "_").replace(/_+/g, "_");
}
function stringCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function sortVersion(left, right) {
  return stringCompare(left.version, right.version) ||
    stringCompare(left.name, right.name);
}
function parseRepository(items) {
  if (!Array.isArray(items) || items.length > 10000) fail("repo_list_invalid");
  const found = new Set();
  return items.map(item => {
    if (!isPlain(item) || typeof item.filename !== "string") {
      fail("repo_entry_invalid");
    }
    const match = FILE_RE.exec(item.filename);
    if (!match || item.filename.length > 260) fail("repo_filename_invalid");
    if (found.has(match[1])) fail("repo_duplicate_version");
    found.add(match[1]);
    if (item.sha256 !== undefined &&
        (typeof item.sha256 !== "string" ||
         !SHA_RE.test(item.sha256))) fail("repo_sha_invalid");
    return {
      version: match[1],
      name: match[2],
      filename: item.filename,
      sha256: item.sha256 ?? null
    };
  }).sort(sortVersion);
}
function parseHosted(items) {
  if (!Array.isArray(items) || items.length > 10000) {
    fail("hosted_list_invalid");
  }
  const found = new Set();
  return items.map(item => {
    if (!isPlain(item) || !VERSION_RE.test(item.version) ||
        !NAME_RE.test(item.name)) {
      fail("hosted_entry_invalid");
    }
    if (found.has(item.version)) fail("hosted_duplicate_version");
    found.add(item.version);
    return { version: item.version, name: item.name };
  }).sort(sortVersion);
}
function riskOf(name) {
  return HIGH_RISK_RE.test(name) ? "high_review_required" : "unclassified";
}
function baseRow() {
  return {
    repo_version: null, repo_name: null, repo_sql_sha256: null,
    hosted_version: null, hosted_name: null,
    match_type: null, name_candidate: null,
    affects_face_lab_or_privileges: "unverified",
    classification: null, evidence_level: "inventory_only",
    object_status: "not_checked",
    action_proposal: "manual_readonly_review",
    decision: "HOLD"
  };
}
function fromRepo(item) {
  return {
    ...baseRow(),
    repo_version: item.version,
    repo_name: item.name,
    repo_sql_sha256: item.sha256,
    affects_face_lab_or_privileges: riskOf(item.name)
  };
}

/**
 * Pure inventory reconciliation, never an "applied" proof. No network,
 * database clients, migration execution, production identity or secrets.
 *
 * Input:
 *  { repository: [{filename,sha256?}], hosted: [{version,name}] }
 * Every item stays represented. A name-only candidate never counts as match.
 */
export function reconcileFaceLabMigrationInventories(input = {}) {
  if (!isPlain(input)) fail("input_invalid");
  const repository = parseRepository(input.repository);
  const hosted = parseHosted(input.hosted);

  const byVersion = new Map(hosted.map(item => [item.version, item]));
  const repoVersions = new Set(repository.map(item => item.version));
  const hostedOnly = hosted.filter(item => !repoVersions.has(item.version));
  const repoOnly = repository.filter(item => !byVersion.has(item.version));

  const repoNames = new Map();
  const hostedNames = new Map();
  for (const item of repoOnly) {
    const key = normalizeName(item.name);
    repoNames.set(key, [...(repoNames.get(key) ?? []), item]);
  }
  for (const item of hostedOnly) {
    const key = normalizeName(item.name);
    hostedNames.set(key, [...(hostedNames.get(key) ?? []), item]);
  }
  const uniqueCandidates = new Map();
  for (const [name, repoItems] of repoNames) {
    const remoteItems = hostedNames.get(name) ?? [];
    if (repoItems.length === 1 && remoteItems.length === 1) {
      uniqueCandidates.set(repoItems[0].version, remoteItems[0].version);
    }
  }
  const reverseCandidates = new Map(
    [...uniqueCandidates].map(([a, b]) => [b, a])
  );

  const rows = [];
  let exact = 0;
  let changedName = 0;
  for (const item of repository) {
    const remote = byVersion.get(item.version);
    const row = fromRepo(item);
    if (remote) {
      row.hosted_version = remote.version;
      row.hosted_name = remote.name;
      row.match_type = item.name === remote.name
        ? "exact_version_and_name" : "version_equal_name_different";
      row.classification = item.name === remote.name
        ? "exact_record" : "version_match_name_drift";
      row.affects_face_lab_or_privileges =
        riskOf(item.name) === "high_review_required" ||
        riskOf(remote.name) === "high_review_required"
          ? "high_review_required" : "unclassified";
      if (item.name === remote.name) exact++;
      else changedName++;
    } else {
      const otherVersion = uniqueCandidates.get(item.version);
      row.match_type = otherVersion ? "name_only_candidate" : "repo_only";
      row.name_candidate = otherVersion;
      row.classification = otherVersion
        ? "renamed_or_reversioned_candidate" : "repo_only_unresolved";
    }
    rows.push(row);
  }
  for (const remote of hostedOnly) {
    const counterpart = reverseCandidates.get(remote.version);
    rows.push({
      ...baseRow(),
      hosted_version: remote.version,
      hosted_name: remote.name,
      match_type: counterpart ? "name_only_candidate" : "hosted_only",
      name_candidate: counterpart ?? null,
      affects_face_lab_or_privileges: riskOf(remote.name),
      classification: counterpart
        ? "renamed_or_reversioned_candidate" : "hosted_only_unresolved"
    });
  }

  const matchCount = exact + changedName;
  const counts = {
    repository: repository.length,
    hosted: hosted.length,
    version_matched: matchCount,
    exact_version_and_name: exact,
    version_match_name_drift: changedName,
    repo_only: repoOnly.length,
    hosted_only: hostedOnly.length,
    unique_name_candidates: uniqueCandidates.size,
    rows: rows.length,
    high_risk_rows: rows.filter(r =>
      r.affects_face_lab_or_privileges === "high_review_required").length
  };
  if (counts.version_matched + counts.repo_only !== counts.repository ||
      counts.version_matched + counts.hosted_only !== counts.hosted ||
      counts.rows !== counts.repository + counts.hosted_only) {
    fail("conservation_violation");
  }
  const sorted = rows.sort((a, b) =>
    stringCompare(a.repo_version ?? a.hosted_version,
      b.repo_version ?? b.hosted_version) ||
    stringCompare(a.match_type, b.match_type)
  );
  return {
    toolVersion: FACE_LAB_MIGRATION_RECONCILER_VERSION,
    inventoryStatus: "complete",
    productionReadiness: "HOLD",
    reason: "offline_manifest_cannot_prove_production_identity_or_applied_sql",
    projectIdentityVerified: false,
    appliedSqlVerified: false,
    databaseAccess: false,
    networkAccess: false,
    migrationExecuted: false,
    counts,
    rows: sorted
  };
}

export const FACE_LAB_MIGRATION_RECONCILIATION_COLUMNS = Object.freeze([
  "repo_version", "repo_name", "repo_sql_sha256",
  "hosted_version", "hosted_name", "match_type", "name_candidate",
  "affects_face_lab_or_privileges", "classification", "evidence_level",
  "object_status", "action_proposal", "decision"
]);

function csvCell(value) {
  const s = String(value ?? "");
  return '"' + s.replaceAll('"', '""') + '"';
}

export function migrationReconciliationCsv(report) {
  if (!isPlain(report) || !Array.isArray(report.rows)) fail("report_invalid");
  return [
    FACE_LAB_MIGRATION_RECONCILIATION_COLUMNS.join(","),
    ...report.rows.map(row =>
      FACE_LAB_MIGRATION_RECONCILIATION_COLUMNS
        .map(key => csvCell(row[key])).join(","))
  ].join("\n") + "\n";
}

export function migrationReconciliationMarkdown(report) {
  if (!isPlain(report) || !isPlain(report.counts)) fail("report_invalid");
  const c = report.counts;
  return [
    "# Face Lab migration inventory — offline, provisional",
    "",
    "**Operational decision: HOLD.** This inventory does not establish",
    "Vercel Production ↔ Supabase identity or that SQL was actually applied.",
    "No DB query, migration replay, GRANT/RLS change, or network access occurred.",
    "",
    "| Measure | Count |",
    "| --- | ---: |",
    "| Repository migration files | " + c.repository + " |",
    "| Hosted manifest records | " + c.hosted + " |",
    "| Matching version | " + c.version_matched + " |",
    "| Exact version and name | " + c.exact_version_and_name + " |",
    "| Matching version, different name | " + c.version_match_name_drift + " |",
    "| Repository only | " + c.repo_only + " |",
    "| Hosted only | " + c.hosted_only + " |",
    "| Unique name-only candidates (not proven) | " + c.unique_name_candidates + " |",
    "| Rows flagged for priority review | " + c.high_risk_rows + " |",
    "",
    "All reported matches are **inventory** matches, not SQL-execution proofs.",
    "A name-only candidate remains two unmatched records; ambiguous name",
    "matches are left unresolved. Review the accompanying CSV.",
    "",
    "Next: verify actual Production DB identity, explain unmatched history,",
    "then inspect Face Lab / auth / RLS / Storage object-level evidence.",
    ""
  ].join("\n");
}
