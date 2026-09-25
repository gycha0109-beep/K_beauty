import { createHash } from "node:crypto";

export const IDENTITY_QUALIFICATION_CONTRACT = "trust-phase8h-source-identity-qualification-v1";

export const IDENTITY_QUALIFICATION_STATES = Object.freeze([
  "QUALIFIED_EXACT",
  "AMBIGUOUS_IDENTITY",
  "WRONG_PRODUCT",
  "WRONG_MARKET",
  "WRONG_VARIANT",
  "WRONG_FORMULATION",
  "ANCHOR_MISSING",
  "UNSUPPORTED_SEMANTICS",
  "TRANSIENT_FAILURE",
  "SOURCE_BLOCKED",
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableQualificationJson(value) {
  return JSON.stringify(stableValue(value));
}

export function qualificationDigest(value) {
  return createHash("sha256").update(stableQualificationJson(value)).digest("hex");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHost(value) {
  return String(value || "").trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

function observationText(observation) {
  return normalizeText([observation?.title, observation?.text].filter(Boolean).join(" "));
}

function anchorChecks(text, anchors = []) {
  return anchors.map((anchor) => ({
    anchor,
    matched: text.includes(normalizeText(anchor)),
  }));
}

function allMatched(checks) {
  return checks.every((row) => row.matched);
}

function anyMatched(checks) {
  return checks.length === 0 || checks.some((row) => row.matched);
}

function exactOrNull(left, right) {
  if (left == null || right == null) return left == null && right == null;
  return String(left) === String(right);
}

function resultWithDigest(base) {
  return { ...base, qualification_digest: qualificationDigest(base) };
}

function finish(input, checks, disposition, reason) {
  return resultWithDigest({
    contract: IDENTITY_QUALIFICATION_CONTRACT,
    historical_source_id: input.historical_source.source_id,
    historical_locator: input.historical_source.canonical_locator,
    historical_publisher: input.historical_source.publisher ?? null,
    historical_source_kind: input.historical_source.source_kind ?? null,
    product_id: input.governed_subject.product_id,
    subject_id: input.governed_subject.subject_id,
    candidate_locator: input.candidate.candidate_locator,
    candidate_publisher: input.candidate.publisher ?? null,
    candidate_source_kind: input.candidate.source_kind ?? null,
    discovery_method: input.candidate.discovery_method,
    disposition,
    reason,
    checks,
    mutation_policy: "READ_ONLY_NO_PRODUCTION_WRITE",
    authority: disposition === "QUALIFIED_EXACT"
      ? "QUALIFICATION_EVIDENCE_ONLY_REQUIRES_GOVERNED_RELOCATION"
      : "NON_AUTHORITATIVE_HOLD",
  });
}

function validateInput(input) {
  if (!input || input.contract !== IDENTITY_QUALIFICATION_CONTRACT) {
    throw new Error("TRUST_PHASE8H_IDENTITY_QUALIFICATION_CONTRACT_INVALID");
  }
  for (const key of ["historical_source", "governed_subject", "candidate", "observation", "requirements"]) {
    if (!input[key] || typeof input[key] !== "object") {
      throw new Error(`TRUST_PHASE8H_IDENTITY_QUALIFICATION_${key.toUpperCase()}_INVALID`);
    }
  }
  if (!input.historical_source.source_id || !input.governed_subject.product_id || !input.governed_subject.subject_id) {
    throw new Error("TRUST_PHASE8H_IDENTITY_QUALIFICATION_IDENTITY_INVALID");
  }
  for (const raw of [input.historical_source.canonical_locator, input.candidate.candidate_locator]) {
    if (!String(raw || "").startsWith("https://")) {
      throw new Error("TRUST_PHASE8H_IDENTITY_QUALIFICATION_HTTPS_REQUIRED");
    }
  }
}

export function qualifyOfficialSourceIdentity(input) {
  validateInput(input);

  const checks = {
    transport: null,
    official_publisher: null,
    product_identity: null,
    subject_identity: null,
    market_match: null,
    variant_match: null,
    formulation_match: null,
    claim_anchor: null,
  };

  const observation = input.observation;
  if (observation.ok !== true) {
    const error = String(observation.error || "SOURCE_BLOCKED:unknown");
    checks.transport = { ok: false, error };
    if (error.startsWith("TRANSIENT_FAILURE:")) {
      return finish(input, checks, "TRANSIENT_FAILURE", error);
    }
    return finish(input, checks, "SOURCE_BLOCKED", error);
  }

  let finalUrl;
  let candidateUrl;
  let historicalUrl;
  try {
    finalUrl = new URL(observation.final_url || input.candidate.candidate_locator);
    candidateUrl = new URL(input.candidate.candidate_locator);
    historicalUrl = new URL(input.historical_source.canonical_locator);
  } catch {
    checks.transport = { ok: false, error: "SOURCE_BLOCKED:invalid_observed_url" };
    return finish(input, checks, "SOURCE_BLOCKED", "SOURCE_BLOCKED:invalid_observed_url");
  }

  checks.transport = {
    ok: true,
    final_url: normalizeUrl(finalUrl),
    candidate_url: normalizeUrl(candidateUrl),
    redirected: normalizeUrl(historicalUrl) !== normalizeUrl(finalUrl),
    content_digest: observation.content_digest ?? null,
    canonical_url: observation.canonical_url ?? null,
    title: observation.title ?? null,
  };

  const allowedHosts = (input.requirements.allowed_hosts || []).map(normalizeHost);
  const finalHost = normalizeHost(finalUrl.hostname);
  const candidatePublisher = normalizeText(input.candidate.publisher);
  const historicalPublisher = normalizeText(input.historical_source.publisher);
  const hostAllowed = allowedHosts.length > 0 && allowedHosts.includes(finalHost);
  const publisherCompatible = !candidatePublisher || !historicalPublisher ||
    candidatePublisher === historicalPublisher ||
    candidatePublisher.includes(historicalPublisher) ||
    historicalPublisher.includes(candidatePublisher);

  checks.official_publisher = {
    ok: hostAllowed && publisherCompatible,
    final_host: finalHost,
    allowed_hosts: allowedHosts,
    publisher_compatible: publisherCompatible,
  };
  if (!checks.official_publisher.ok) {
    return finish(input, checks, "SOURCE_BLOCKED", "official_publisher_scope_not_proven");
  }

  if (finalUrl.pathname === "/" && historicalUrl.pathname !== "/") {
    checks.product_identity = { ok: false, reason: "redirect_landed_on_site_root" };
    return finish(input, checks, "AMBIGUOUS_IDENTITY", "product_specific_source_collapsed_to_site_root");
  }

  const text = observationText(observation);
  const productAll = anchorChecks(text, input.requirements.product_anchors_all || []);
  const productAny = anchorChecks(text, input.requirements.product_anchors_any || []);
  const productAllOk = allMatched(productAll);
  const productAnyOk = anyMatched(productAny);
  checks.product_identity = { ok: productAllOk && productAnyOk, all: productAll, any: productAny };
  if (!checks.product_identity.ok) {
    const matchedCount = [...productAll, ...productAny].filter((row) => row.matched).length;
    return finish(
      input,
      checks,
      matchedCount > 0 ? "AMBIGUOUS_IDENTITY" : "WRONG_PRODUCT",
      matchedCount > 0 ? "partial_product_identity_only" : "required_product_identity_anchors_absent",
    );
  }

  const reviewed = input.reviewed_binding || null;
  if (reviewed) {
    const productOk = String(reviewed.product_id || "") === String(input.governed_subject.product_id);
    const subjectOk = String(reviewed.subject_id || "") === String(input.governed_subject.subject_id);
    checks.subject_identity = {
      ok: productOk && subjectOk && reviewed.binding_state === "resolved",
      product_id_match: productOk,
      subject_id_match: subjectOk,
      binding_state: reviewed.binding_state ?? null,
      review_version: reviewed.review_version ?? null,
    };
    if (!productOk) return finish(input, checks, "WRONG_PRODUCT", "reviewed_binding_product_mismatch");
    if (!checks.subject_identity.ok) return finish(input, checks, "AMBIGUOUS_IDENTITY", "reviewed_binding_subject_not_exact");
  } else {
    checks.subject_identity = {
      ok: input.requirements.allow_anchor_only_subject_proof === true,
      proof: input.requirements.allow_anchor_only_subject_proof === true ? "anchor_only_explicitly_allowed" : "reviewed_binding_absent",
    };
    if (!checks.subject_identity.ok) {
      return finish(input, checks, "UNSUPPORTED_SEMANTICS", "reviewed_subject_lineage_not_proven");
    }
  }

  const governedMarket = input.governed_subject.market ?? input.historical_source.market ?? null;
  const candidateMarket = input.candidate.market ?? null;
  const reviewedMarket = reviewed?.source_market ?? reviewed?.market_code ?? null;
  const marketAnchorChecks = anchorChecks(text, input.requirements.market_anchors_all || []);
  const marketAnchorOk = allMatched(marketAnchorChecks);
  const candidateMarketOk = governedMarket == null || candidateMarket == null || String(governedMarket) === String(candidateMarket);
  const reviewedMarketOk = governedMarket == null || reviewedMarket == null || String(governedMarket) === String(reviewedMarket);
  checks.market_match = {
    ok: candidateMarketOk && reviewedMarketOk && marketAnchorOk,
    governed_market: governedMarket,
    candidate_market: candidateMarket,
    reviewed_market: reviewedMarket,
    anchors: marketAnchorChecks,
  };
  if (!checks.market_match.ok) {
    return finish(input, checks, "WRONG_MARKET", "market_identity_not_exact");
  }

  const governedVariant = input.governed_subject.variant_key ?? null;
  const reviewedVariant = reviewed?.variant_key ?? null;
  const variantAnchorChecks = anchorChecks(text, input.requirements.variant_anchors_all || []);
  const variantAnchorOk = allMatched(variantAnchorChecks);
  const variantOk = governedVariant == null || (exactOrNull(governedVariant, reviewedVariant) && variantAnchorOk);
  checks.variant_match = {
    ok: variantOk,
    governed_variant: governedVariant,
    reviewed_variant: reviewedVariant,
    anchors: variantAnchorChecks,
  };
  if (!variantOk) return finish(input, checks, "WRONG_VARIANT", "variant_identity_not_exact");

  const governedFormulation = input.governed_subject.formulation_revision_key ?? null;
  const reviewedFormulation = reviewed?.formulation_revision_key ?? null;
  if (reviewed && governedFormulation != null && reviewedFormulation != null && String(governedFormulation) !== String(reviewedFormulation)) {
    checks.formulation_match = {
      ok: false,
      governed_formulation: governedFormulation,
      reviewed_formulation: reviewedFormulation,
      proof: "reviewed_binding_mismatch",
    };
    return finish(input, checks, "WRONG_FORMULATION", "reviewed_binding_formulation_mismatch");
  }

  const formulationAnchorChecks = anchorChecks(text, input.requirements.formulation_anchors_all || []);
  const formulationAnchorsOk = allMatched(formulationAnchorChecks);
  const reviewedRedirectLineage = Boolean(
    reviewed &&
    governedFormulation != null &&
    reviewedFormulation != null &&
    String(governedFormulation) === String(reviewedFormulation) &&
    normalizeUrl(reviewed.source_url) === normalizeUrl(input.historical_source.canonical_locator) &&
    input.candidate.discovery_method === "official_http_redirect"
  );
  const formulationOk = governedFormulation == null || reviewedRedirectLineage ||
    (input.requirements.allow_anchor_only_formulation_proof === true && formulationAnchorsOk);
  checks.formulation_match = {
    ok: formulationOk,
    governed_formulation: governedFormulation,
    reviewed_formulation: reviewedFormulation,
    reviewed_redirect_lineage: reviewedRedirectLineage,
    anchors: formulationAnchorChecks,
  };
  if (!formulationOk) {
    return finish(input, checks, "UNSUPPORTED_SEMANTICS", "formulation_lineage_not_proven");
  }

  const claimChecks = anchorChecks(text, input.requirements.claim_anchors_all || []);
  checks.claim_anchor = { ok: allMatched(claimChecks), anchors: claimChecks };
  if (!checks.claim_anchor.ok) {
    return finish(input, checks, "ANCHOR_MISSING", "required_claim_anchor_absent");
  }

  return finish(input, checks, "QUALIFIED_EXACT", "exact_governed_identity_proven");
}
