import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { rebuildPremiumDecisionState } from "@/lib/premium-decision-state";
import {
  createPremiumReportSession,
  PREMIUM_REPORT_COOKIE
} from "@/lib/premium-report-session";
import { buildPremiumReportSnapshot } from "@/lib/premium-report-snapshot";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfig
} from "@/lib/supabase-admin";
import { createRouteSupabaseAuthClient } from "@/lib/supabase/server-client";
import { createNoStoreHeaders } from "@/lib/security/error-redaction";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GATE_VERSION = "stage9-route-storage-reentry-hosted-v1";
const PASS_MARKER = "STAGE_9_ROUTE_STORAGE_REENTRY_HOSTED_PASS";
const FAIL_MARKER = "STAGE_9_ROUTE_STORAGE_REENTRY_HOSTED_FAIL";
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class GateError extends Error {
  constructor(step, code) {
    super(code);
    this.name = "GateError";
    this.step = step;
    this.code = code;
  }
}

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: createNoStoreHeaders()
  });
}

function requireGate(condition, step, code) {
  if (!condition) throw new GateError(step, code);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, stable(value[key])])
  );
}

function semanticHash(value) {
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}

function deterministicUuid(runId, label) {
  const bytes = createHash("sha256")
    .update(`${GATE_VERSION}:${runId}:${label}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
}

function createPassword() {
  return `S9!${randomBytes(32).toString("base64url")}`;
}

function reportFixture(runId) {
  const axes = [
    "barrier",
    "redness",
    "dehydration",
    "oiliness",
    "acne",
    "pores",
    "uneven_tone",
    "uv"
  ];
  const concernScores = Object.fromEntries(
    axes.map((axis) => [axis, { total: axis === "dehydration" ? 25 : 5 }])
  );
  const answers = {
    skinType: "combination",
    sensitivity: "low",
    mainConcerns: ["dehydration"],
    primaryConcern: "dehydration",
    postWashFeeling: "comfortable",
    afternoonSkinChange: "mostly_same",
    cleansingFrequency: "twice",
    environmentExposure: [],
    preferredTexture: "gel",
    mostDislikedFeel: "sticky",
    genderPreference: "unspecified",
    recentSkinChange: "no",
    recentlyChangedProduct: "no",
    sunscreenPreferenceState: "answered",
    whiteCastHate: false,
    toneUpWanted: false,
    makeupUse: false,
    eyeSensitive: false
  };
  const freeResult = {
    summary: "Stage 9 deterministic route and persistence fixture.",
    priority: { axis: "dehydration", score: 25 },
    scoring: { concernScores },
    answers,
    topPick: null,
    morning: [],
    night: [],
    meta: {
      stage9RunId: runId,
      fixtureVersion: GATE_VERSION
    }
  };
  return rebuildPremiumDecisionState(
    {
      freeResult,
      currentProducts: {
        selections: [],
        summary: { total: 0 }
      },
      photoEvidenceState: {
        status: "not_provided"
      },
      faceLabSummary: {
        status: "not_provided"
      },
      locale: "ko"
    },
    {
      locale: "ko",
      source: "stage9_route_storage_reentry_hosted"
    }
  );
}

function parseSessionId(token) {
  try {
    const encoded = String(token || "").split(".", 1)[0];
    if (!encoded) return null;
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );
    return typeof payload?.sid === "string" ? payload.sid : null;
  } catch {
    return null;
  }
}

function cookieMapFromHeader(header) {
  const map = new Map();
  for (const part of String(header || "").split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    map.set(trimmed.slice(0, index), trimmed.slice(index + 1));
  }
  return map;
}

function mergeCookieHeaders(...headers) {
  const map = new Map();
  for (const header of headers) {
    for (const [name, value] of cookieMapFromHeader(header)) {
      map.set(name, value);
    }
  }
  return [...map.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function extractCookieValue(headers, name) {
  const values =
    typeof headers?.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers?.get?.("set-cookie")].filter(Boolean);
  for (const value of values) {
    const first = String(value || "").split(";", 1)[0];
    const index = first.indexOf("=");
    if (index <= 0) continue;
    if (first.slice(0, index).trim() === name) {
      return first.slice(index + 1);
    }
  }
  return null;
}

async function createSsrSession({ supabaseUrl, anonKey, email, password }) {
  const jar = new Map();
  const client = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return [...jar.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          jar.set(name, value);
        }
      }
    }
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });
  requireGate(
    !error && data?.session?.access_token && data?.user?.id,
    "auth_sign_in",
    "temporary_user_sign_in_failed"
  );
  return {
    accessToken: data.session.access_token,
    userId: data.user.id,
    cookieHeader: [...jar.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ")
  };
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function recordStep(steps, name, response, expected) {
  const passed = expected(response);
  steps.push({
    name,
    status: response.status,
    passed
  });
  requireGate(passed, name, `${name}_failed`);
}

async function countRows(query) {
  const { count, error } = await query;
  return error ? null : Number(count || 0);
}

export async function POST(request) {
  const runtimeSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "")
    .trim()
    .toLowerCase();
  const expectedSha = String(
    request.nextUrl.searchParams.get("expectedSha") || ""
  )
    .trim()
    .toLowerCase();
  const runId = String(request.nextUrl.searchParams.get("run") || "")
    .trim()
    .toLowerCase();

  if (
    process.env.VERCEL_ENV !== "preview" ||
    !SHA_PATTERN.test(runtimeSha) ||
    expectedSha !== runtimeSha ||
    !UUID_PATTERN.test(runId)
  ) {
    return json(
      {
        version: GATE_VERSION,
        verdict: FAIL_MARKER,
        error: {
          step: "precondition",
          code: "preview_exact_head_guard_rejected"
        }
      },
      404
    );
  }

  const steps = [];
  const createdUserIds = [];
  const knownSessionIds = new Set();
  const createdSavedReportIds = new Set();
  const userIds = {
    a: deterministicUuid(runId, "account-a"),
    b: deterministicUuid(runId, "account-b")
  };
  const emails = {
    a: `stage9.${runId}.a@example.com`,
    b: `stage9.${runId}.b@example.com`
  };
  const passwords = {
    a: createPassword(),
    b: createPassword()
  };

  let admin = null;
  let firstRowBeforeConflict = null;
  let firstFingerprint = null;
  let secondFingerprint = null;
  let firstSnapshotImmutable = false;
  let secondSessionDistinct = false;
  let duplicateSourceTuplesZero = false;
  let finalError = null;
  let cleanup = {
    savedReportsDeleted: 0,
    sessionsDeleted: 0,
    profilesDeleted: 0,
    authUsersDeleted: 0,
    savedReportResidue: null,
    sessionResidue: null,
    profileResidue: null,
    authUserResidue: null,
    residueZero: false
  };

  const incomingCookie = request.headers.get("cookie") || "";
  const incomingBypass =
    request.headers.get("x-vercel-protection-bypass") || "";
  const origin = request.nextUrl.origin;

  async function callRoute(
    name,
    path,
    {
      method = "GET",
      cookieHeader = "",
      bearer = "",
      body = undefined
    } = {}
  ) {
    void name;
    const headers = new Headers({
      accept: "application/json",
      "cache-control": "no-store"
    });
    const cookies = mergeCookieHeaders(incomingCookie, cookieHeader);
    if (cookies) headers.set("cookie", cookies);
    if (bearer) headers.set("authorization", `Bearer ${bearer}`);
    if (incomingBypass) {
      headers.set("x-vercel-protection-bypass", incomingBypass);
    }
    if (body !== undefined) headers.set("content-type", "application/json");

    const response = await fetch(new URL(path, origin), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      redirect: "manual"
    });
    return {
      status: response.status,
      body: await readJsonResponse(response),
      headers: response.headers
    };
  }

  try {
    const adminConfig = getSupabaseAdminConfig();
    const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
    requireGate(
      adminConfig?.supabaseUrl &&
        adminConfig?.supabaseServiceRoleKey &&
        anonKey,
      "configuration",
      "supabase_configuration_missing"
    );
    admin = createSupabaseAdminClient();
    requireGate(admin, "configuration", "supabase_admin_unavailable");

    const createA = await admin.auth.admin.createUser({
      id: userIds.a,
      email: emails.a,
      password: passwords.a,
      email_confirm: true,
      app_metadata: {
        premium_entitlement: "admin_override",
        role: "stage9_test"
      },
      user_metadata: {
        name: "Stage 9 Account A"
      }
    });
    requireGate(
      !createA.error && createA.data?.user?.id === userIds.a,
      "create_account_a",
      "temporary_account_a_create_failed"
    );
    createdUserIds.push(userIds.a);

    const createB = await admin.auth.admin.createUser({
      id: userIds.b,
      email: emails.b,
      password: passwords.b,
      email_confirm: true,
      app_metadata: {
        premium_entitlement: "admin_override",
        role: "stage9_test"
      },
      user_metadata: {
        name: "Stage 9 Account B"
      }
    });
    requireGate(
      !createB.error && createB.data?.user?.id === userIds.b,
      "create_account_b",
      "temporary_account_b_create_failed"
    );
    createdUserIds.push(userIds.b);

    const [accountA, accountB] = await Promise.all([
      createSsrSession({
        supabaseUrl: adminConfig.supabaseUrl,
        anonKey,
        email: emails.a,
        password: passwords.a
      }),
      createSsrSession({
        supabaseUrl: adminConfig.supabaseUrl,
        anonKey,
        email: emails.b,
        password: passwords.b
      })
    ]);
    requireGate(
      accountA.userId === userIds.a && accountB.userId === userIds.b,
      "auth_identity",
      "temporary_identity_mismatch"
    );
    steps.push({
      name: "temporary_accounts",
      status: 200,
      passed: true
    });

    const premiumReport = reportFixture(runId);
    const initialSnapshot = buildPremiumReportSnapshot(premiumReport);
    requireGate(
      premiumReport?.decisionBundle &&
        premiumReport?.freeResult &&
        initialSnapshot?.fingerprint,
      "fixture",
      "deterministic_fixture_invalid"
    );

    const initialPremiumToken = await createPremiumReportSession({
      premiumReport,
      locale: "ko"
    });
    const initialSessionId = parseSessionId(initialPremiumToken);
    requireGate(
      initialPremiumToken && initialSessionId,
      "session_create",
      "initial_premium_session_create_failed"
    );
    knownSessionIds.add(initialSessionId);

    const authCookieA = accountA.cookieHeader;
    const authCookieB = accountB.cookieHeader;
    const premiumCookieA = `${PREMIUM_REPORT_COOKIE}=${initialPremiumToken}`;
    const accountAWithPremium = mergeCookieHeaders(
      authCookieA,
      premiumCookieA
    );

    const anonymous = await callRoute(
      "anonymous_rejection",
      "/api/full-report",
      {
        method: "POST",
        body: { locale: "ko" }
      }
    );
    recordStep(
      steps,
      "anonymous_rejection",
      anonymous,
      (result) =>
        result.status === 401 && result.body?.error === "login_required"
    );

    const beforeSave = await callRoute(
      "session_before_save",
      "/api/full-report/session",
      {
        cookieHeader: accountAWithPremium
      }
    );
    recordStep(
      steps,
      "session_before_save",
      beforeSave,
      (result) =>
        result.status === 200 && result.body?.hasSavedReport === false
    );

    const reportBody = {
      locale: "ko",
      currentProducts: []
    };
    const firstSave = await callRoute(
      "first_save",
      "/api/full-report",
      {
        method: "POST",
        cookieHeader: accountAWithPremium,
        body: reportBody
      }
    );
    recordStep(
      steps,
      "first_save",
      firstSave,
      (result) =>
        result.status === 200 &&
        result.body?.meta?.persistence?.status === "saved" &&
        typeof result.body?.meta?.persistence?.savedReportId === "string" &&
        /^[0-9a-f]{64}$/i.test(
          result.body?.meta?.snapshot?.fingerprint || ""
        )
    );
    const firstSavedReportId =
      firstSave.body.meta.persistence.savedReportId;
    createdSavedReportIds.add(firstSavedReportId);
    firstFingerprint = firstSave.body.meta.snapshot.fingerprint;

    const firstAdminRead = await admin
      .from("saved_reports")
      .select(
        "id, user_id, report_type, report_version, source_type, source_session_id, premium_report, created_at, updated_at"
      )
      .eq("id", firstSavedReportId)
      .maybeSingle();
    requireGate(
      !firstAdminRead.error &&
        firstAdminRead.data?.user_id === userIds.a &&
        firstAdminRead.data?.report_type === "premium" &&
        firstAdminRead.data?.source_type ===
          "premium_report_session" &&
        firstAdminRead.data?.source_session_id === initialSessionId,
      "admin_persistence_read",
      "stored_row_contract_invalid"
    );
    firstRowBeforeConflict = firstAdminRead.data;
    const storedSnapshot = buildPremiumReportSnapshot(
      firstRowBeforeConflict.premium_report
    );
    requireGate(
      storedSnapshot?.fingerprint === firstFingerprint &&
        firstRowBeforeConflict.report_version ===
          storedSnapshot.reportVersion,
      "snapshot_persistence",
      "stored_snapshot_mismatch"
    );
    const versionValues = [
      storedSnapshot.version,
      storedSnapshot.reportVersion,
      storedSnapshot.decisionBundleVersion
    ];
    requireGate(
      versionValues.every(
        (value) => typeof value === "string" && value.length > 0
      ) && new Set(versionValues).size === 3,
      "version_separation",
      "version_contract_invalid"
    );

    const rlsA = createRouteSupabaseAuthClient(accountA.accessToken);
    const rlsB = createRouteSupabaseAuthClient(accountB.accessToken);
    requireGate(rlsA && rlsB, "rls_clients", "rls_client_unavailable");
    const [rlsReadA, rlsReadB] = await Promise.all([
      rlsA
        .from("saved_reports")
        .select("id, user_id, report_type, source_type")
        .eq("id", firstSavedReportId)
        .maybeSingle(),
      rlsB
        .from("saved_reports")
        .select("id, user_id, report_type, source_type")
        .eq("id", firstSavedReportId)
        .maybeSingle()
    ]);
    requireGate(
      !rlsReadA.error &&
        rlsReadA.data?.id === firstSavedReportId &&
        rlsReadA.data?.user_id === userIds.a,
      "rls_owner_read",
      "owner_rls_read_failed"
    );
    requireGate(
      !rlsReadB.error && rlsReadB.data === null,
      "rls_cross_account",
      "cross_account_rls_read_exposed"
    );
    steps.push({
      name: "persistence_evidence",
      status: 200,
      passed: true
    });

    const identical = await callRoute(
      "identical_retry",
      "/api/full-report",
      {
        method: "POST",
        cookieHeader: accountAWithPremium,
        body: reportBody
      }
    );
    recordStep(
      steps,
      "identical_retry",
      identical,
      (result) =>
        result.status === 200 &&
        result.body?.meta?.persistence?.status === "existing" &&
        result.body?.meta?.persistence?.savedReportId ===
          firstSavedReportId &&
        result.body?.meta?.snapshot?.fingerprint === firstFingerprint
    );

    const reopened = await callRoute(
      "saved_reopen",
      "/api/full-report",
      {
        method: "POST",
        cookieHeader: authCookieA,
        body: {
          savedReportId: firstSavedReportId,
          locale: "en",
          topPick: { id: "tamper" }
        }
      }
    );
    recordStep(
      steps,
      "saved_reopen",
      reopened,
      (result) =>
        result.status === 200 &&
        result.body?.meta?.source === "saved-report" &&
        result.body?.meta?.locale === "ko" &&
        result.body?.meta?.snapshot?.fingerprint === firstFingerprint &&
        semanticHash(result.body?.freeResult?.topPick || null) ===
          semanticHash(
            firstRowBeforeConflict.premium_report?.freeResult
              ?.topPick || null
          )
    );

    const conflict = await callRoute(
      "finalized_conflict",
      "/api/full-report",
      {
        method: "POST",
        cookieHeader: accountAWithPremium,
        body: {
          locale: "ko",
          currentProducts: [
            {
              category: "treatment",
              status: "not_in_db"
            }
          ]
        }
      }
    );
    recordStep(
      steps,
      "finalized_conflict",
      conflict,
      (result) =>
        result.status === 409 &&
        result.body?.error === "premium_snapshot_finalized"
    );

    const afterConflict = await admin
      .from("saved_reports")
      .select("premium_report, updated_at")
      .eq("id", firstSavedReportId)
      .maybeSingle();
    requireGate(
      !afterConflict.error &&
        semanticHash(afterConflict.data?.premium_report) ===
          semanticHash(firstRowBeforeConflict.premium_report) &&
        afterConflict.data?.updated_at ===
          firstRowBeforeConflict.updated_at,
      "conflict_immutability",
      "stored_snapshot_mutated_after_conflict"
    );
    firstSnapshotImmutable = true;

    const crossAccount = await callRoute(
      "cross_account_saved_report",
      "/api/full-report",
      {
        method: "POST",
        cookieHeader: authCookieB,
        body: {
          savedReportId: firstSavedReportId,
          locale: "ko"
        }
      }
    );
    recordStep(
      steps,
      "cross_account_saved_report",
      crossAccount,
      (result) =>
        result.status === 401 &&
        result.body?.error ===
          "premium_session_missing_or_expired"
    );

    const principalConflict = await callRoute(
      "principal_conflict",
      "/api/full-report",
      {
        method: "POST",
        cookieHeader: authCookieA,
        bearer: accountB.accessToken,
        body: {
          savedReportId: firstSavedReportId,
          locale: "ko"
        }
      }
    );
    recordStep(
      steps,
      "principal_conflict",
      principalConflict,
      (result) =>
        result.status === 401 &&
        result.body?.error === "premium_principal_conflict"
    );

    const sessionAfterSave = await callRoute(
      "session_after_save",
      "/api/full-report/session",
      {
        cookieHeader: accountAWithPremium
      }
    );
    recordStep(
      steps,
      "session_after_save",
      sessionAfterSave,
      (result) =>
        result.status === 200 &&
        result.body?.hasSavedReport === true &&
        result.body?.savedReportId === firstSavedReportId
    );

    const rotation = await callRoute(
      "session_rotation",
      "/api/full-report/session",
      {
        method: "POST",
        cookieHeader: accountAWithPremium
      }
    );
    recordStep(
      steps,
      "session_rotation",
      rotation,
      (result) => {
        const serialized = JSON.stringify(result.body || {});
        return (
          result.status === 200 &&
          result.body?.rotated === true &&
          result.body?.reason === "new_session_created" &&
          !["sessionId", "premiumSessionToken", "accessToken"].some(
            (key) => serialized.includes(key)
          )
        );
      }
    );

    const rotatedPremiumToken = extractCookieValue(
      rotation.headers,
      PREMIUM_REPORT_COOKIE
    );
    const rotatedSessionId = parseSessionId(rotatedPremiumToken);
    requireGate(
      rotatedPremiumToken &&
        rotatedPremiumToken !== initialPremiumToken &&
        rotatedSessionId &&
        rotatedSessionId !== initialSessionId,
      "rotation_cookie",
      "rotated_cookie_contract_invalid"
    );
    secondSessionDistinct = true;
    knownSessionIds.add(rotatedSessionId);

    const rotatedCookie = `${PREMIUM_REPORT_COOKIE}=${rotatedPremiumToken}`;
    const accountAWithRotatedPremium = mergeCookieHeaders(
      authCookieA,
      rotatedCookie
    );
    const secondSave = await callRoute(
      "second_save",
      "/api/full-report",
      {
        method: "POST",
        cookieHeader: accountAWithRotatedPremium,
        body: reportBody
      }
    );
    recordStep(
      steps,
      "second_save",
      secondSave,
      (result) =>
        result.status === 200 &&
        result.body?.meta?.persistence?.status === "saved" &&
        typeof result.body?.meta?.persistence?.savedReportId ===
          "string" &&
        result.body?.meta?.persistence?.savedReportId !==
          firstSavedReportId
    );
    const secondSavedReportId =
      secondSave.body.meta.persistence.savedReportId;
    createdSavedReportIds.add(secondSavedReportId);
    secondFingerprint = secondSave.body.meta.snapshot.fingerprint;

    const secondRead = await admin
      .from("saved_reports")
      .select(
        "id, user_id, report_type, source_type, source_session_id, premium_report, updated_at"
      )
      .eq("id", secondSavedReportId)
      .maybeSingle();
    requireGate(
      !secondRead.error &&
        secondRead.data?.user_id === userIds.a &&
        secondRead.data?.source_session_id === rotatedSessionId &&
        secondRead.data?.source_session_id !==
          firstRowBeforeConflict.source_session_id &&
        buildPremiumReportSnapshot(
          secondRead.data?.premium_report
        )?.fingerprint === secondFingerprint,
      "second_persistence",
      "second_saved_row_contract_invalid"
    );

    const firstAfterSecond = await admin
      .from("saved_reports")
      .select("premium_report, updated_at")
      .eq("id", firstSavedReportId)
      .maybeSingle();
    requireGate(
      !firstAfterSecond.error &&
        semanticHash(firstAfterSecond.data?.premium_report) ===
          semanticHash(firstRowBeforeConflict.premium_report) &&
        firstAfterSecond.data?.updated_at ===
          firstRowBeforeConflict.updated_at,
      "first_snapshot_after_rotation",
      "first_snapshot_changed_after_rotation"
    );

    const tupleRows = await admin
      .from("saved_reports")
      .select("source_session_id")
      .eq("user_id", userIds.a)
      .eq("report_type", "premium")
      .eq("source_type", "premium_report_session");
    requireGate(
      !tupleRows.error &&
        tupleRows.data?.length === 2 &&
        new Set(
          tupleRows.data.map((row) => row.source_session_id)
        ).size === tupleRows.data.length,
      "source_tuple_uniqueness",
      "duplicate_source_session_tuple"
    );
    duplicateSourceTuplesZero = true;
    steps.push({
      name: "rotation_and_second_save",
      status: 200,
      passed: true
    });
  } catch (error) {
    finalError =
      error instanceof GateError
        ? error
        : new GateError("unhandled", "unexpected_failure");
  } finally {
    if (admin) {
      const cleanupErrors = [];
      const scopedUsers = [...createdUserIds];

      try {
        if (scopedUsers.length) {
          const existingRows = await admin
            .from("saved_reports")
            .select("id")
            .in("user_id", scopedUsers)
            .eq("report_type", "premium")
            .eq("source_type", "premium_report_session");
          if (existingRows.error) {
            cleanupErrors.push("saved_report_lookup");
          } else {
            for (const row of existingRows.data || []) {
              createdSavedReportIds.add(row.id);
            }
            if (createdSavedReportIds.size) {
              const deleted = await admin
                .from("saved_reports")
                .delete()
                .in("id", [...createdSavedReportIds])
                .select("id");
              if (deleted.error) {
                cleanupErrors.push("saved_report_delete");
              } else {
                cleanup.savedReportsDeleted =
                  deleted.data?.length || 0;
              }
            }
          }
        }
      } catch {
        cleanupErrors.push("saved_report_cleanup");
      }

      try {
        const marker = {
          freeResult: {
            meta: {
              stage9RunId: runId
            }
          }
        };
        if (!scopedUsers.length) {
          knownSessionIds.clear();
        }
        if (scopedUsers.length) {
          const matchingSessions = await admin
            .from("premium_report_sessions")
            .select("session_id")
            .contains("premium_report", marker);
          if (matchingSessions.error) {
            cleanupErrors.push("session_lookup");
          } else {
            for (const row of matchingSessions.data || []) {
              if (row.session_id) knownSessionIds.add(row.session_id);
            }
          }
        }
        if (knownSessionIds.size) {
          const deleted = await admin
            .from("premium_report_sessions")
            .delete()
            .in("session_id", [...knownSessionIds])
            .select("session_id");
          if (deleted.error) {
            cleanupErrors.push("session_delete");
          } else {
            cleanup.sessionsDeleted = deleted.data?.length || 0;
          }
        }
      } catch {
        cleanupErrors.push("session_cleanup");
      }

      try {
        if (scopedUsers.length) {
          const deleted = await admin
            .from("profiles")
            .delete()
            .in("id", scopedUsers)
            .select("id");
          if (deleted.error) {
            cleanupErrors.push("profile_delete");
          } else {
            cleanup.profilesDeleted = deleted.data?.length || 0;
          }
        }
      } catch {
        cleanupErrors.push("profile_cleanup");
      }

      for (const userId of [...createdUserIds].reverse()) {
        try {
          const deleted = await admin.auth.admin.deleteUser(userId);
          if (deleted.error) {
            cleanupErrors.push("auth_user_delete");
          } else {
            cleanup.authUsersDeleted += 1;
          }
        } catch {
          cleanupErrors.push("auth_user_cleanup");
        }
      }

      try {
        cleanup.savedReportResidue = scopedUsers.length
          ? await countRows(
              admin
                .from("saved_reports")
                .select("id", { count: "exact", head: true })
                .in("user_id", scopedUsers)
            )
          : 0;
      } catch {
        cleanupErrors.push("saved_report_residue");
      }

      try {
        cleanup.sessionResidue = scopedUsers.length
          ? await countRows(
              admin
                .from("premium_report_sessions")
                .select("session_id", { count: "exact", head: true })
                .contains("premium_report", {
                  freeResult: {
                    meta: {
                      stage9RunId: runId
                    }
                  }
                })
            )
          : 0;
      } catch {
        cleanupErrors.push("session_residue");
      }

      try {
        cleanup.profileResidue = scopedUsers.length
          ? await countRows(
              admin
                .from("profiles")
                .select("id", { count: "exact", head: true })
                .in("id", scopedUsers)
            )
          : 0;
      } catch {
        cleanupErrors.push("profile_residue");
      }

      let authResidue = 0;
      for (const userId of createdUserIds) {
        try {
          const lookup = await admin.auth.admin.getUserById(userId);
          if (lookup.data?.user) authResidue += 1;
        } catch {
          cleanupErrors.push("auth_user_residue");
        }
      }
      cleanup.authUserResidue = authResidue;
      cleanup.residueZero =
        cleanupErrors.length === 0 &&
        cleanup.savedReportResidue === 0 &&
        cleanup.sessionResidue === 0 &&
        cleanup.profileResidue === 0 &&
        cleanup.authUserResidue === 0;

      if (!cleanup.residueZero && !finalError) {
        finalError = new GateError(
          "cleanup",
          "cleanup_residue_or_error"
        );
      }
    } else if (!finalError) {
      finalError = new GateError(
        "cleanup",
        "cleanup_admin_unavailable"
      );
    }
  }

  const passed =
    !finalError &&
    cleanup.residueZero &&
    steps.length >= 13 &&
    steps.every((step) => step.passed);

  return json(
    {
      version: GATE_VERSION,
      verdict: passed ? PASS_MARKER : FAIL_MARKER,
      runtimeSha,
      runId,
      steps,
      invariants: {
        temporaryAccountsDistinct: userIds.a !== userIds.b,
        firstSnapshotImmutable,
        secondSessionDistinct,
        duplicateSourceTuplesZero,
        allStepsPassed: steps.every((step) => step.passed)
      },
      fingerprints: {
        first: firstFingerprint,
        second: secondFingerprint
      },
      cleanup,
      error: finalError
        ? {
            step: finalError.step,
            code: finalError.code
          }
        : null
    },
    passed ? 200 : 500
  );
}
