import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CANONICAL_OBSERVATION_PROFILE,
  createBlindJudgmentInput
} from "@bejewely/face-contracts";
import { observeCandidate } from "../../src/observation/observe-candidate.js";
import { CANONICAL_OBSERVATION_SNAPSHOT } from "../../src/observation/snapshot/canonical-v1.js";
import { ELIGIBLE_PARITY_FIXTURE, INVALID_PARITY_FIXTURE } from "../../src/observation/parity-fixtures.js";
import { readObservationObject } from "../../src/observation/register-observation-run.js";

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function setup() {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "bejewely-t4-"));
  const relative = "objects/canonical/by-sha/aa/canonical.png";
  const absolute = path.join(dataRoot, ...relative.split("/"));
  await mkdir(path.dirname(absolute), { recursive: true });
  const bytes = Buffer.from("synthetic-canonical-image-bytes");
  await writeFile(absolute, bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { dataRoot, relative, sha256, cleanup: () => rm(dataRoot, { recursive: true, force: true }) };
}

function requestFor(asset, mode = "fixture_replay", replicateOrdinal = 1) {
  return {
    schemaVersion: "observation-run-request-v1",
    candidate: {
      candidateId: "cand_0123456789abcdef01234567",
      canonicalAsset: {
        sha256: asset.sha256,
        objectRelativePath: asset.relative,
        transformPolicyVersion: "canonical-image-v1"
      }
    },
    adapterProfile: { id: CANONICAL_OBSERVATION_PROFILE.id, version: CANONICAL_OBSERVATION_PROFILE.version },
    contractSnapshotId: CANONICAL_OBSERVATION_SNAPSHOT.snapshotId,
    execution: {
      mode,
      requestedModel: mode === "fixture_replay" ? CANONICAL_OBSERVATION_PROFILE.fixtureModel : CANONICAL_OBSERVATION_PROFILE.providerModel,
      replicateOrdinal
    }
  };
}

function advancingClock() {
  let tick = Date.parse("2026-08-02T00:00:00.000Z");
  return () => new Date(tick += 1000);
}

test("preflight has zero persistent writes and fixture execute publishes manifest last", async () => {
  const asset = await setup();
  try {
    const request = requestFor(asset);
    const preflight = await observeCandidate({ request, action: "preflight", dataRoot: asset.dataRoot });
    assert.equal(preflight.ok, true);
    assert.equal(preflight.state, "ready");
    assert.equal(preflight.persistentWrites, 0);
    assert.equal(await exists(path.join(asset.dataRoot, "observation-runs")), false);

    const first = await observeCandidate({ request, action: "execute", dataRoot: asset.dataRoot, now: advancingClock() });
    assert.equal(first.ok, true);
    assert.equal(first.run.authority, "fixture_only");
    assert.equal(first.run.outcome, "observed_bundle");
    assert.equal(first.run.execution.imageProviderAttemptCount, 0);
    assert.equal(await exists(path.join(asset.dataRoot, "observation-runs", request.candidate.candidateId, first.run.runId, "claim.json")), true);
    assert.equal(await exists(path.join(asset.dataRoot, "observation-runs", request.candidate.candidateId, first.run.runId, "manifest.json")), true);

    const second = await observeCandidate({ request, action: "execute", dataRoot: asset.dataRoot, now: advancingClock() });
    assert.equal(second.ok, true);
    assert.equal(second.state, "existing_run");
    assert.equal(second.run.runId, first.run.runId);

    const object = await readObservationObject(asset.dataRoot, first.run.observation);
    assert.equal(object.bundle.status, "available");
    assert.throws(() => createBlindJudgmentInput({ run: first.run, observationObject: object, blindCandidate: request.candidate }), /unavailable/);
  } finally {
    await asset.cleanup();
  }
});

test("invalid fixture creates a contract-failure run and no observation object", async () => {
  const asset = await setup();
  try {
    const request = requestFor(asset);
    const result = await observeCandidate({ request, action: "execute", dataRoot: asset.dataRoot, fixturePayload: INVALID_PARITY_FIXTURE, now: advancingClock() });
    assert.equal(result.ok, false);
    assert.equal(result.state, "registered_failure");
    assert.equal(result.run.outcome, "contract_failure");
    assert.equal(result.run.observation, null);
    assert.equal(result.run.failure.code, "provider_contract_invalid");
  } finally {
    await asset.cleanup();
  }
});

test("provider execution calls fetch once and produces authoritative blind judgment input", async () => {
  const asset = await setup();
  let calls = 0;
  try {
    const request = requestFor(asset, "provider_bounded");
    const fakeFetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(ELIGIBLE_PARITY_FIXTURE) } }],
        usage: { prompt_tokens: 10, completion_tokens: 20 }
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const first = await observeCandidate({ request, action: "execute", dataRoot: asset.dataRoot, apiKey: "test-key", fetchImpl: fakeFetch, now: advancingClock() });
    assert.equal(first.ok, true);
    assert.equal(calls, 1);
    assert.equal(first.run.authority, "observed_image");
    assert.equal(first.run.execution.imageProviderAttemptCount, 1);
    const object = await readObservationObject(asset.dataRoot, first.run.observation);
    const handoff = createBlindJudgmentInput({ run: first.run, observationObject: object, blindCandidate: request.candidate });
    assert.equal(handoff.candidateId, request.candidate.candidateId);
    assert.equal("generation" in handoff, false);
    assert.equal("execution" in handoff, false);

    const second = await observeCandidate({ request, action: "execute", dataRoot: asset.dataRoot, apiKey: "test-key", fetchImpl: fakeFetch, now: advancingClock() });
    assert.equal(second.state, "existing_run");
    assert.equal(calls, 1);
  } finally {
    await asset.cleanup();
  }
});

test("missing credential creates no claim and a higher replicate ordinal creates a new run", async () => {
  const asset = await setup();
  try {
    const providerRequest = requestFor(asset, "provider_bounded");
    const missing = await observeCandidate({ request: providerRequest, action: "execute", dataRoot: asset.dataRoot });
    assert.equal(missing.ok, false);
    assert.equal(missing.errors[0].code, "provider_credential_missing");
    assert.equal(await exists(path.join(asset.dataRoot, "observation-runs")), false);

    const first = await observeCandidate({ request: requestFor(asset, "fixture_replay", 1), action: "execute", dataRoot: asset.dataRoot, now: advancingClock() });
    const second = await observeCandidate({ request: requestFor(asset, "fixture_replay", 2), action: "execute", dataRoot: asset.dataRoot, now: advancingClock() });
    assert.notEqual(first.run.runId, second.run.runId);
  } finally {
    await asset.cleanup();
  }
});

test("existing claim without manifest blocks hidden retry", async () => {
  const asset = await setup();
  try {
    const request = requestFor(asset);
    const preflight = await observeCandidate({ request, action: "preflight", dataRoot: asset.dataRoot });
    const runDirectory = path.join(asset.dataRoot, "observation-runs", request.candidate.candidateId, preflight.runId);
    await mkdir(runDirectory, { recursive: true });
    await writeFile(path.join(runDirectory, "claim.json"), JSON.stringify({ runDigest: preflight.runDigest }));
    const result = await observeCandidate({ request, action: "execute", dataRoot: asset.dataRoot });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "execution_state_uncertain");
  } finally {
    await asset.cleanup();
  }
});


test("tampered observation object and unsafe object reference fail closed", async () => {
  const asset = await setup();
  try {
    const request = requestFor(asset);
    const result = await observeCandidate({ request, action: "execute", dataRoot: asset.dataRoot, now: advancingClock() });
    const unsafeReference = { ...result.run.observation, objectRelativePath: "../escape.json" };
    await assert.rejects(() => readObservationObject(asset.dataRoot, unsafeReference), /observation_reference_invalid/);

    const objectPath = path.join(asset.dataRoot, ...result.run.observation.objectRelativePath.split("/"));
    const object = JSON.parse(await readFile(objectPath, "utf8"));
    object.bundle.skin.signals.redness = 5;
    await writeFile(objectPath, JSON.stringify(object));
    await assert.rejects(() => readObservationObject(asset.dataRoot, result.run.observation), /observation_object_integrity_invalid/);
  } finally {
    await asset.cleanup();
  }
});

test("tampered run manifest is not accepted as an idempotent existing run", async () => {
  const asset = await setup();
  try {
    const request = requestFor(asset);
    const result = await observeCandidate({ request, action: "execute", dataRoot: asset.dataRoot, now: advancingClock() });
    const manifestPath = path.join(asset.dataRoot, "observation-runs", request.candidate.candidateId, result.run.runId, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.authority = "observed_image";
    await writeFile(manifestPath, JSON.stringify(manifest));
    const replay = await observeCandidate({ request, action: "execute", dataRoot: asset.dataRoot, now: advancingClock() });
    assert.equal(replay.ok, false);
    assert.equal(replay.errors[0].code, "run_manifest_integrity_invalid");
  } finally {
    await asset.cleanup();
  }
});
