import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, relative, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildFaceLabV2Canonical } from "../lib/face-lab-v2/canonical-composer.js";
import { buildFaceLabV2CoverageCohort } from "../lib/face-lab-v2/evaluation/harness.js";
import { isFaceLabObservationAnalysis } from "../lib/face-lab-analysis-bundle.js";

const DEFAULT_BASE_URL = "https://k-beauty-two.vercel.app";
const DEFAULT_SOURCE_IMAGE = "public/test-assets/kakao-test-face.png";
const SUPABASE_URL_PATTERN = /https:\/\/[a-z0-9-]+\.supabase\.(?:co|in)/gi;
const LEGACY_ANON_KEY_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const PUBLISHABLE_KEY_PATTERN = /sb_publishable_[A-Za-z0-9_-]+/g;
const MAX_DISCOVERY_RESOURCES = 40;
const MAX_DISCOVERY_BODY_BYTES = 2 * 1024 * 1024;
const REQUIRED_SIMULATION_HEADERS = Object.freeze({
  simulationVersion: "x-face-lab-simulation-version",
  routeId: "x-face-lab-route-id",
  lookId: "x-face-lab-look-id",
  renderSpecSha256: "x-face-lab-render-spec-sha256",
  instructionVersion: "x-face-lab-instruction-version",
  providerConfigVersion: "x-face-lab-provider-config-version",
  providerConfigFingerprint: "x-face-lab-provider-config-fingerprint",
  reviewCaseId: "x-face-lab-review-case-id",
  reviewTicket: "x-face-lab-review-ticket",
  reviewExpiresAt: "x-face-lab-review-expires-at"
});

function requiredEnv(name, { trim = true } = {}) {
  const raw = String(process.env[name] || "");
  const value = trim ? raw.trim() : raw;
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function safeAuthErrorCode(error) {
  const value = String(error?.code || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return value || "unknown";
}

function resolveE2EAuthEmail(email, label, bootstrapUsers) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!bootstrapUsers) return normalized;

  const match = normalized.match(/^([^@]+)@(gmail\.com|googlemail\.com)$/);
  if (!match) return normalized;

  const local = match[1].split("+")[0];
  return `${local}+bejewely-face-lab-e2e-${label.toLowerCase()}@${match[2]}`;
}

function normalizeBaseUrl(value) {
  const url = new URL(String(value || DEFAULT_BASE_URL).trim());
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("invalid_face_lab_e2e_base_url");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.origin;
}

function parseBoundedInt(name, fallback, min, max) {
  const raw = String(process.env[name] || "").trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`invalid_${name.toLowerCase()}`);
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function decodeJwtPayload(value) {
  try {
    const parts = String(value || "").split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function isPublicSupabaseKey(value) {
  const key = String(value || "").trim();
  if (key.startsWith("sb_publishable_")) return true;
  return decodeJwtPayload(key)?.role === "anon";
}

function scanPublicConfigText(text, current = {}) {
  const input = String(text || "");
  let supabaseUrl = current.supabaseUrl || "";
  let anonKey = current.anonKey || "";

  if (!supabaseUrl) {
    const match = input.match(SUPABASE_URL_PATTERN)?.[0];
    if (match) supabaseUrl = match.replace(/\/$/, "");
  }
  if (!anonKey) {
    const match = input.match(PUBLISHABLE_KEY_PATTERN)?.find(isPublicSupabaseKey);
    if (match) anonKey = match;
  }
  if (!anonKey) {
    const match = input.match(LEGACY_ANON_KEY_PATTERN)?.find(isPublicSupabaseKey);
    if (match) anonKey = match;
  }

  return { supabaseUrl, anonKey };
}

async function discoverPublicConfig(baseUrl) {
  let config = {
    supabaseUrl: String(process.env.FACE_LAB_E2E_SUPABASE_URL || "").trim(),
    anonKey: String(process.env.FACE_LAB_E2E_SUPABASE_ANON_KEY || "").trim()
  };

  if (config.supabaseUrl && isPublicSupabaseKey(config.anonKey)) return config;

  const pageResponse = await fetch(baseUrl, {
    headers: { "User-Agent": "bejewely-face-lab-e2e/1.0" },
    redirect: "follow"
  });
  if (!pageResponse.ok) throw new Error(`base_url_http_${pageResponse.status}`);

  const html = await pageResponse.text();
  config = scanPublicConfigText(html, config);
  if (config.supabaseUrl && config.anonKey) return config;

  const resourceUrls = [];
  const scriptPattern = /<script[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = scriptPattern.exec(html)) && resourceUrls.length < MAX_DISCOVERY_RESOURCES) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin === baseUrl) resourceUrls.push(url.href);
    } catch {}
  }

  for (const url of [...new Set(resourceUrls)]) {
    if (config.supabaseUrl && config.anonKey) break;
    const response = await fetch(url, { redirect: "follow" }).catch(() => null);
    if (!response?.ok) continue;
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_DISCOVERY_BODY_BYTES) continue;
    const body = await response.arrayBuffer().catch(() => null);
    if (!body || body.byteLength > MAX_DISCOVERY_BODY_BYTES) continue;
    config = scanPublicConfigText(Buffer.from(body).toString("utf8"), config);
  }

  if (!config.supabaseUrl || !isPublicSupabaseKey(config.anonKey)) {
    throw new Error("supabase_public_config_discovery_failed");
  }
  return config;
}

function projectAuthenticatedAccount(label, data) {
  if (!data?.session?.access_token || !data?.user?.id || data.user.is_anonymous) {
    throw new Error(`face_lab_e2e_auth_failed_${label.toLowerCase()}_session_invalid`);
  }
  return {
    label,
    userId: data.user.id,
    accessToken: data.session.access_token
  };
}

async function signInAccount({
  label,
  email,
  password,
  supabaseUrl,
  anonKey,
  bootstrap = false
}) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  const signIn = await client.auth.signInWithPassword({ email, password });
  if (!signIn.error) {
    return {
      account: projectAuthenticatedAccount(label, signIn.data),
      confirmationRequired: false
    };
  }

  const signInCode = safeAuthErrorCode(signIn.error);
  if (bootstrap && signInCode === "email_not_confirmed") {
    const resend = await client.auth.resend({
      type: "signup",
      email
    });
    if (resend.error) {
      throw new Error(
        `face_lab_e2e_auth_resend_failed_${label.toLowerCase()}_${safeAuthErrorCode(resend.error)}`
      );
    }
    return {
      account: null,
      confirmationRequired: true
    };
  }

  if (!bootstrap || signInCode !== "invalid_credentials") {
    throw new Error(
      `face_lab_e2e_auth_failed_${label.toLowerCase()}_${signInCode}`
    );
  }

  const signUp = await client.auth.signUp({ email, password });
  if (signUp.error) {
    throw new Error(
      `face_lab_e2e_auth_bootstrap_failed_${label.toLowerCase()}_${safeAuthErrorCode(signUp.error)}`
    );
  }

  if (signUp.data?.session?.access_token) {
    return {
      account: projectAuthenticatedAccount(label, signUp.data),
      confirmationRequired: false
    };
  }

  return {
    account: null,
    confirmationRequired: true
  };
}

function imageMimeType(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "image/png";
}

async function postFaceReading({ baseUrl, sourcePath, sourceBytes, mimeType, token }) {
  const form = new FormData();
  form.append("image", new Blob([sourceBytes], { type: mimeType }), basename(sourcePath));
  form.append("locale", "ko");

  const response = await fetch(`${baseUrl}/api/face-reading-test`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || body?.status !== "available") {
    throw new Error(`face_reading_failed_${response.status}_${body?.failureReason || body?.error || "unknown"}`);
  }

  const analysis = body?.data?.analysis;
  if (!isFaceLabObservationAnalysis(analysis)) {
    throw new Error("face_reading_analysis_invalid");
  }
  if (!body?.simulationAuthority?.token) {
    throw new Error("simulation_authority_missing");
  }

  return {
    analysis,
    simulationAuthority: body.simulationAuthority
  };
}

function buildPilotIntents(analysis, intentCount) {
  const coverage = buildFaceLabV2CoverageCohort();
  const groups = new Map();

  for (const caseDef of coverage.cases) {
    const targetKey = caseDef?.surveyAnswers?.targetSelections?.[0];
    if (!targetKey) continue;
    if (!groups.has(targetKey)) groups.set(targetKey, []);
    groups.get(targetKey).push(caseDef);
  }

  const selectedTargets = [...groups.entries()].slice(0, intentCount);
  if (selectedTargets.length !== intentCount) {
    throw new Error("pilot_distinct_target_coverage_insufficient");
  }

  return selectedTargets.map(([targetKey, cases], index) => {
    for (let offset = 0; offset < cases.length; offset += 1) {
      const source = cases[(index + offset) % cases.length];
      const surveyAnswers = source?.surveyAnswers;
      const preview = buildFaceLabV2Canonical({
        analysis,
        surveyAnswers,
        targetFinderResult: null,
        selectedRouteId: null,
        locale: "ko"
      });
      const route = preview?.routes?.routes?.[0];
      if (!route?.routeId) continue;

      const committed = buildFaceLabV2Canonical({
        analysis,
        surveyAnswers,
        targetFinderResult: null,
        selectedRouteId: route.routeId,
        locale: "ko"
      });
      if (committed?.routes?.selectionState !== "user_selected" ||
          committed?.appearanceHandoff?.status !== "available") {
        continue;
      }

      return {
        intentGroupId: `intent-${String(index + 1).padStart(2, "0")}`,
        targetKey,
        scopeProfile: source.tags?.find((tag) => tag.startsWith("scope_profile:")) || null,
        surveyAnswers,
        targetFinderResult: null,
        selectedRouteId: route.routeId,
        expectedRouteId: route.routeId
      };
    }

    throw new Error(`pilot_intent_route_missing_${targetKey}`);
  });
}

async function postSimulation({
  baseUrl,
  sourcePath,
  sourceBytes,
  mimeType,
  token,
  simulationAuthority,
  analysis,
  state
}) {
  const form = new FormData();
  form.append("image", new Blob([sourceBytes], { type: mimeType }), basename(sourcePath));
  form.append("locale", "ko");
  form.append("simulationAuthority", simulationAuthority.token);
  form.append("analysis", JSON.stringify(analysis));
  form.append("faceLabV2State", JSON.stringify(state));

  const response = await fetch(`${baseUrl}/api/face-lab-simulation-test`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": `face-lab-e2e-${randomUUID()}`
    },
    body: form
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(`simulation_failed_${response.status}_${body?.error || "unknown"}`);
  }

  const meta = {};
  for (const [key, header] of Object.entries(REQUIRED_SIMULATION_HEADERS)) {
    const value = response.headers.get(header);
    if (!value) throw new Error(`simulation_header_missing_${key}`);
    meta[key] = value;
  }

  const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim();
  if (!contentType.startsWith("image/")) throw new Error("simulation_content_type_invalid");
  const imageBytes = Buffer.from(await response.arrayBuffer());
  if (!imageBytes.length) throw new Error("simulation_output_empty");

  return {
    imageBytes,
    mimeType: contentType,
    meta
  };
}

async function fetchReviewTemplate({ baseUrl, token, reviewTicket, analysis, state }) {
  const response = await fetch(`${baseUrl}/api/face-lab-simulation-review-test`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      mode: "template",
      reviewTicket,
      analysis,
      faceLabV2State: state,
      locale: "ko"
    })
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true || body?.mode !== "template") {
    throw new Error(`review_template_failed_${response.status}_${body?.error || "unknown"}`);
  }
  return body;
}

function outputExtension(mimeType) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  return ".png";
}

function safeCampaignId(value) {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9._-]{6,80}$/.test(normalized)) {
    throw new Error("invalid_campaign_id");
  }
  return normalized;
}

function defaultCampaignId() {
  return `G-E-PILOT-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.FACE_LAB_E2E_BASE_URL || DEFAULT_BASE_URL);
  const sourcePath = resolve(process.cwd(), process.env.FACE_LAB_E2E_IMAGE_PATH || DEFAULT_SOURCE_IMAGE);
  const privateRoot = resolve(process.cwd(), process.env.FACE_LAB_E2E_PRIVATE_ROOT || "private");
  const persistOutputs = process.env.FACE_LAB_E2E_PERSIST_OUTPUTS === "1" || (!process.env.CI && process.env.FACE_LAB_E2E_PERSIST_OUTPUTS !== "0");
  const intentCount = parseBoundedInt("FACE_LAB_E2E_INTENTS", 4, 1, 4);
  const generationsPerIntent = parseBoundedInt("FACE_LAB_E2E_GENERATIONS", 2, 1, 2);
  const campaignId = safeCampaignId(process.env.FACE_LAB_E2E_CAMPAIGN_ID || defaultCampaignId());

  if (basename(privateRoot) !== "private") {
    throw new Error("face_lab_e2e_private_root_must_be_private");
  }

  const [sourceBytes, publicConfig] = await Promise.all([
    readFile(sourcePath),
    discoverPublicConfig(baseUrl)
  ]);
  if (!sourceBytes.length) throw new Error("source_image_empty");

  const expectedCaseCount = intentCount * generationsPerIntent;
  const bootstrapUsers = process.env.FACE_LAB_E2E_BOOTSTRAP_USERS === "1";
  const credentialsA = {
    email: resolveE2EAuthEmail(
      requiredEnv("FACE_LAB_E2E_EMAIL_A"),
      "A",
      bootstrapUsers
    ),
    password: requiredEnv("FACE_LAB_E2E_PASSWORD_A", { trim: false })
  };
  const credentialsB = expectedCaseCount > 1
    ? {
        email: resolveE2EAuthEmail(
          requiredEnv("FACE_LAB_E2E_EMAIL_B"),
          "B",
          bootstrapUsers
        ),
        password: requiredEnv("FACE_LAB_E2E_PASSWORD_B", { trim: false })
      }
    : null;

  const authResults = await Promise.all([
    signInAccount({
      label: "A",
      ...credentialsA,
      ...publicConfig,
      bootstrap: bootstrapUsers
    }),
    credentialsB
      ? signInAccount({
          label: "B",
          ...credentialsB,
          ...publicConfig,
          bootstrap: bootstrapUsers
        })
      : Promise.resolve(null)
  ]);

  const confirmationLabels = authResults
    .filter((item) => item?.confirmationRequired)
    .map((item, index) => index === 0 ? "a" : "b");
  if (confirmationLabels.length) {
    throw new Error(
      `face_lab_e2e_auth_confirmation_required_${confirmationLabels.join("_")}`
    );
  }

  const accountA = authResults[0]?.account || null;
  const accountB = authResults[1]?.account || null;
  if (!accountA) throw new Error("face_lab_e2e_auth_failed_a_session_missing");
  if (expectedCaseCount > 1) {
    if (!accountB) throw new Error("face_lab_e2e_auth_failed_b_session_missing");
    assert.notEqual(accountA.userId, accountB.userId, "face_lab_e2e_accounts_must_be_distinct");
  }

  const mimeType = imageMimeType(sourcePath);
  const reading = await postFaceReading({
    baseUrl,
    sourcePath,
    sourceBytes,
    mimeType,
    token: accountA.accessToken
  });
  const intents = buildPilotIntents(reading.analysis, intentCount);
  const campaignDir = resolve(privateRoot, "face-lab-g-e2b", campaignId);
  const cases = [];
  let runtimeBinding = null;
  let sequence = 0;

  if (persistOutputs) {
    await mkdir(campaignDir, { recursive: true });
    await writeFile(resolve(campaignDir, `source${extname(sourcePath).toLowerCase() || ".png"}`), sourceBytes);
  }

  for (const intent of intents) {
    let pairedRenderSpecSha256 = null;

    for (let generationIndex = 1; generationIndex <= generationsPerIntent; generationIndex += 1) {
      const account = sequence % 2 === 0 || !accountB ? accountA : accountB;
      sequence += 1;
      const state = {
        surveyAnswers: intent.surveyAnswers,
        targetFinderResult: intent.targetFinderResult,
        selectedRouteId: intent.selectedRouteId
      };

      const simulation = await postSimulation({
        baseUrl,
        sourcePath,
        sourceBytes,
        mimeType,
        token: account.accessToken,
        simulationAuthority: reading.simulationAuthority,
        analysis: reading.analysis,
        state
      });

      assert.equal(simulation.meta.routeId, intent.expectedRouteId, "simulation_route_binding_mismatch");

      if (pairedRenderSpecSha256 == null) {
        pairedRenderSpecSha256 = simulation.meta.renderSpecSha256;
      } else {
        assert.equal(
          simulation.meta.renderSpecSha256,
          pairedRenderSpecSha256,
          "repeat_generation_render_spec_mismatch"
        );
      }

      const nextRuntimeBinding = {
        simulationVersion: simulation.meta.simulationVersion,
        instructionVersion: simulation.meta.instructionVersion,
        providerConfigVersion: simulation.meta.providerConfigVersion,
        providerConfigFingerprint: simulation.meta.providerConfigFingerprint
      };
      if (runtimeBinding == null) {
        runtimeBinding = nextRuntimeBinding;
      } else {
        assert.deepEqual(nextRuntimeBinding, runtimeBinding, "campaign_runtime_binding_mismatch");
      }

      const reviewTemplate = await fetchReviewTemplate({
        baseUrl,
        token: account.accessToken,
        reviewTicket: simulation.meta.reviewTicket,
        analysis: reading.analysis,
        state
      });
      assert.equal(reviewTemplate.caseId, simulation.meta.reviewCaseId, "review_case_binding_mismatch");
      assert.equal(reviewTemplate.trace?.renderSpecSha256, simulation.meta.renderSpecSha256, "review_render_spec_binding_mismatch");
      assert.equal(reviewTemplate.trace?.providerConfigFingerprint, simulation.meta.providerConfigFingerprint, "review_provider_binding_mismatch");

      const caseName = `${intent.intentGroupId}-g${generationIndex}`;
      const extension = outputExtension(simulation.mimeType);
      const outputFile = `${caseName}.output${extension}`;
      const inputFile = `${caseName}.review-input.json`;

      const safeMeta = {
        caseName,
        caseId: simulation.meta.reviewCaseId,
        intentGroupId: intent.intentGroupId,
        generationIndex,
        account: account.label,
        routeId: simulation.meta.routeId,
        lookId: simulation.meta.lookId,
        renderSpecSha256: simulation.meta.renderSpecSha256,
        simulationVersion: simulation.meta.simulationVersion,
        instructionVersion: simulation.meta.instructionVersion,
        providerConfigVersion: simulation.meta.providerConfigVersion,
        providerConfigFingerprint: simulation.meta.providerConfigFingerprint,
        outputSha256: sha256(simulation.imageBytes),
        outputMimeType: simulation.mimeType,
        outputFile: persistOutputs ? outputFile : null,
        reviewInputFile: persistOutputs ? inputFile : null
      };

      if (persistOutputs) {
        await writeFile(resolve(campaignDir, outputFile), simulation.imageBytes);
        await writeFile(
          resolve(campaignDir, inputFile),
          `${JSON.stringify({
            schemaVersion: "face-lab-g-e2b-provider-review-input-v1",
            campaignId,
            caseId: simulation.meta.reviewCaseId,
            intentGroupId: intent.intentGroupId,
            generationIndex,
            sourceImagePath: `./source${extname(sourcePath).toLowerCase() || ".png"}`,
            outputImagePath: `./${outputFile}`,
            analysis: reading.analysis,
            faceLabV2State: state,
            reviewTemplate,
            simulation: {
              routeId: simulation.meta.routeId,
              lookId: simulation.meta.lookId,
              renderSpecSha256: simulation.meta.renderSpecSha256,
              simulationVersion: simulation.meta.simulationVersion,
              instructionVersion: simulation.meta.instructionVersion,
              providerConfigVersion: simulation.meta.providerConfigVersion,
              providerConfigFingerprint: simulation.meta.providerConfigFingerprint
            }
          }, null, 2)}\n`,
          "utf8"
        );
      }

      cases.push(safeMeta);
      console.log(JSON.stringify({
        event: "face_lab_g_e2b_generation_complete",
        caseName,
        caseId: safeMeta.caseId,
        account: account.label,
        routeId: safeMeta.routeId,
        renderSpecSha256: safeMeta.renderSpecSha256,
        providerConfigVersion: safeMeta.providerConfigVersion,
        providerConfigFingerprint: safeMeta.providerConfigFingerprint,
        persisted: persistOutputs
      }));
    }
  }

  assert.equal(cases.length, expectedCaseCount, "pilot_case_count_mismatch");
  assert.ok(runtimeBinding, "campaign_runtime_binding_missing");

  const manifest = {
    schemaVersion: "face-lab-g-e2b-provider-pilot-e2e-v1",
    status: "complete",
    campaignId,
    baseHost: new URL(baseUrl).hostname,
    intentCount,
    generationsPerIntent,
    caseCount: cases.length,
    sourceSha256: sha256(sourceBytes),
    runtimeBinding,
    accounts: {
      distinct: accountB ? accountA.userId !== accountB.userId : null,
      activeLabels: accountB ? ["A", "B"] : ["A"]
    },
    cases
  };

  if (persistOutputs) {
    await writeFile(resolve(campaignDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify({
    ok: true,
    verdict: "FACE_LAB_G_E2B_PROVIDER_E2E_PASS",
    campaignId,
    caseCount: cases.length,
    runtimeBinding,
    persisted: persistOutputs,
    outputDirectory: persistOutputs ? relative(process.cwd(), campaignDir) : null
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    verdict: "FACE_LAB_G_E2B_PROVIDER_E2E_FAIL",
    code: String(error?.message || "unknown_error").replace(/[\r\n]+/g, " ").slice(0, 240)
  }));
  process.exitCode = 1;
});
