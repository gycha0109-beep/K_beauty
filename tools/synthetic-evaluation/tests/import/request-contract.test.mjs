import assert from "node:assert/strict";
import test from "node:test";
import { validateCandidateImportRequest } from "@bejewely/face-contracts";
import { clone, createTestImportEnvironment } from "./helpers.mjs";

function codes(result) {
  return result.errors.map((item) => item.code);
}

test("valid import request passes exact validation", async () => {
  const { request } = await createTestImportEnvironment();
  assert.deepEqual(validateCandidateImportRequest(request), { ok: true, errors: [] });
});

test("unknown fields and weak attestation fail closed", async () => {
  const { request } = await createTestImportEnvironment();
  const unknown = clone(request);
  unknown.intendedLabel = "clean";
  assert.ok(codes(validateCandidateImportRequest(unknown)).includes("invalid_request_schema"));

  const realPerson = clone(request);
  realPerson.operatorAttestation.realPersonReferenceUsed = true;
  assert.ok(codes(validateCandidateImportRequest(realPerson)).includes("synthetic_attestation_required"));

  const rights = clone(request);
  rights.operatorAttestation.termsAndRightsReviewed = false;
  assert.ok(codes(validateCandidateImportRequest(rights)).includes("rights_review_required"));
});

test("external mark provenance stays unverified", async () => {
  const { request } = await createTestImportEnvironment();
  const marked = clone(request);
  marked.operatorHints.visibleExternalMark = {
    status: "present",
    location: "bottom_right",
    provenanceStatus: "unverified"
  };
  assert.equal(validateCandidateImportRequest(marked).ok, true);

  marked.operatorHints.visibleExternalMark.provenanceStatus = "gemini_confirmed";
  assert.ok(codes(validateCandidateImportRequest(marked)).includes("invalid_request_schema"));
});

test("sensitive provenance and invalid timestamps are rejected", async () => {
  const { request } = await createTestImportEnvironment();
  const sensitive = clone(request);
  sensitive.operatorHints.notes = "Bearer secret-token-value";
  assert.ok(codes(validateCandidateImportRequest(sensitive)).includes("sensitive_provenance_forbidden"));

  const invalidTime = clone(request);
  invalidTime.providerRun.downloadedAt = "yesterday";
  assert.ok(codes(validateCandidateImportRequest(invalidTime)).includes("invalid_request_schema"));
});
