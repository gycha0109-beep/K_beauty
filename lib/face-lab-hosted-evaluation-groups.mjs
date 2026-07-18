const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;

function assertSafeText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function createProviderGroupId(item) {
  const fixtureId = assertSafeText(item?.fixtureId, "fixtureId");
  const repetition = item?.repetition;
  if (!SAFE_ID.test(fixtureId)) throw new Error("fixtureId must use safe identifier characters");
  if (!Number.isSafeInteger(repetition) || repetition < 1) {
    throw new Error("repetition must be a positive safe integer");
  }
  return `${fixtureId}:${repetition}`;
}

function assertCompatibleCase(group, item) {
  for (const key of [
    "fixtureId",
    "subjectId",
    "comparisonGroup",
    "variantRole",
    "expectedEligibility",
    "expectedDegradation",
    "imagePath",
    "imagePathPortable",
    "declaredMime",
    "repetition"
  ]) {
    if ((group.template[key] ?? null) !== (item[key] ?? null)) {
      throw new Error(`provider group ${group.providerGroupId} has inconsistent ${key}`);
    }
  }
}

export function buildHostedEvaluationProviderGroups(cases, { maxProviderCalls = 20 } = {}) {
  if (!Array.isArray(cases) || !cases.length) {
    throw new Error("cases must be a non-empty array");
  }
  if (!Number.isSafeInteger(maxProviderCalls) || maxProviderCalls < 1) {
    throw new Error("maxProviderCalls must be a positive safe integer");
  }

  const groupsById = new Map();
  const orderedGroups = [];

  for (const item of cases) {
    const caseId = assertSafeText(item?.caseId, "caseId");
    const locale = assertSafeText(item?.locale, "locale");
    const providerGroupId = createProviderGroupId(item);
    let group = groupsById.get(providerGroupId);

    if (!group) {
      group = {
        providerGroupId,
        fixtureId: item.fixtureId,
        repetition: item.repetition,
        imagePath: item.imagePath,
        declaredMime: item.declaredMime ?? null,
        template: item,
        cases: [],
        locales: [],
        localeSet: new Set()
      };
      groupsById.set(providerGroupId, group);
      orderedGroups.push(group);
    } else {
      assertCompatibleCase(group, item);
    }

    if (group.localeSet.has(locale)) {
      throw new Error(`provider group ${providerGroupId} contains duplicate locale ${locale}`);
    }
    if (group.cases.some((candidate) => candidate.caseId === caseId)) {
      throw new Error(`duplicate caseId in provider group ${providerGroupId}`);
    }

    group.localeSet.add(locale);
    group.locales.push(locale);
    group.cases.push(item);
  }

  if (orderedGroups.length > maxProviderCalls) {
    throw new Error(`planned provider call count ${orderedGroups.length} exceeds maxProviderCalls ${maxProviderCalls}`);
  }

  return orderedGroups.map((group) => ({
    providerGroupId: group.providerGroupId,
    fixtureId: group.fixtureId,
    repetition: group.repetition,
    imagePath: group.imagePath,
    declaredMime: group.declaredMime,
    providerLocale: group.localeSet.has("ko") ? "ko" : group.locales[0],
    locales: [...group.locales],
    cases: [...group.cases]
  }));
}

export function selectPendingHostedEvaluationProviderGroups(groups, pendingCases) {
  if (!Array.isArray(groups)) throw new Error("groups must be an array");
  if (!Array.isArray(pendingCases)) throw new Error("pendingCases must be an array");
  const pendingIds = new Set(pendingCases.map((item) => assertSafeText(item?.caseId, "caseId")));

  return groups
    .map((group) => ({
      ...group,
      pendingCases: group.cases.filter((item) => pendingIds.has(item.caseId))
    }))
    .filter((group) => group.pendingCases.length > 0);
}

export function createSharedHostedEvaluationTransport(transport) {
  const status = typeof transport?.status === "string" ? transport.status : "network_error";
  const originalReason = typeof transport?.reasonCode === "string" && transport.reasonCode
    ? transport.reasonCode
    : status;
  return {
    status,
    httpStatus: Number.isInteger(transport?.httpStatus) ? transport.httpStatus : null,
    attemptCount: 0,
    retryCount: 0,
    retryExhausted: transport?.retryExhausted === true,
    retryAfterMs: Number.isSafeInteger(transport?.retryAfterMs) && transport.retryAfterMs >= 0
      ? transport.retryAfterMs
      : null,
    durationMs: null,
    reasonCode: `shared_provider_result:${originalReason}`.slice(0, 96)
  };
}
