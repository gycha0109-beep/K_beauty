/**
 * P2 evidence-first shadow model, deliberately independent of catalog/SKU authority.
 * The existing catalog is an assertion to compare, never ground truth.
 * An indexed third-party listing is a lead, NOT retained first-party proof.
 * This module has no network/DB access and cannot authorize any write.
 */
export const P2_EVIDENCE_FIRST_SHADOW="trust-p2-evidence-first-shadow-v1";
const INDEX="PUBLIC_INDEX_SECONDARY_REVIEW_ONLY";
const FROZEN="trust-p2d-five-brand-live-cohort-v2";
const AUDIT="trust-p2d-secondary-listing-unit-audit-v1";
const OBS="trust-p2f6-public-pre-resolved-readonly-evidence-v1";
const invalid=reason=>{throw Error("P2_EVIDENCE_FIRST_"+reason);};
const positiveNumber=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
const validUrl=x=>{try{
  const u=new URL(x);
  return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash;
}catch{return false;}};
function requireFrozen(cohort,audit,prior){
  if(cohort?.contract!==FROZEN||audit?.contract!==AUDIT||
    prior?.contract!==OBS||!Array.isArray(cohort.targets)||
    !Array.isArray(audit.cases)||!Array.isArray(prior.outcomes)||
    cohort.targets.length!==5||audit.cases.length!==5||
    prior.outcomes.length!==5||
    new Set(cohort.targets.map(x=>x.productId)).size!==5||
    new Set(audit.cases.map(x=>x.productId)).size!==5||
    new Set(prior.outcomes.map(x=>x.brand)).size!==5||
    prior.frozenDenominator!==5||
    !audit.safety||Object.values(audit.safety).some(x=>x!==0)||
    audit.catalogReadOnlyCheck?.writes!==0||
    audit.catalogReadOnlyCheck?.accessMode!==
      "READ_ONLY_SELECT_BY_FROZEN_PRODUCT_IDS")
    invalid("FROZEN_OR_AUTHORITY_DRIFT");
}
/**
 * Atomized observations never collapse a physical container into its sale
 * offer or infer a new official product identity.
 */
export function extractP2SecondaryClaimAtoms(listing){
  if(listing?.listingEvidence!==INDEX||!validUrl(listing.url)||
    !/^[a-z0-9]{2,40}$/i.test(listing.provider??"")||
    !Number.isInteger(listing.physicalContainerCount)||
    listing.physicalContainerCount<1||listing.physicalContainerCount>12||
    (listing.unitVolumeMl!==null&&!positiveNumber(listing.unitVolumeMl))||
    (listing.sheetCount!==null&&(!Number.isInteger(listing.sheetCount)||
      listing.sheetCount<=0))||
    (listing.unitVolumeMl===null&&listing.sheetCount===null))
    invalid("UNSAFE_OR_AMBIGUOUS_LISTING");
  const atoms=[
    {dimension:"OFFER_PHYSICAL_UNIT_COUNT",scope:"SALE_OFFER",
      value:listing.physicalContainerCount,unit:"container"},
  ];
  if(listing.unitVolumeMl!==null)atoms.push({
    dimension:"PHYSICAL_CONTAINER_CAPACITY",scope:"PHYSICAL_UNIT",
    value:listing.unitVolumeMl,unit:"ml",
  });
  if(listing.sheetCount!==null)atoms.push({
    dimension:"PHYSICAL_CONTAINER_PAD_COUNT",scope:"PHYSICAL_UNIT",
    value:listing.sheetCount,unit:"sheet",
  });
  return Object.freeze(atoms.map(x=>Object.freeze({
    ...x,sourceProvider:listing.provider,sourceUrl:listing.url,
    sourceClass:"THIRD_PARTY_INDEX_LEAD",
    originalEvidenceBytesRetained:false,
    officialSourceVerified:false,exactSkuVerified:false,
  })));
}
/**
 * Case-agnostic shadow interpretation across a frozen sample. This deliberately
 * does NOT export a confirmed product, fact, SKU, market, or catalog correction.
 */
export function reportP2EvidenceFirstShadow(cohort,audit,prior){
  requireFrozen(cohort,audit,prior);
  const rows=[];
  for(const target of cohort.targets){
    const cases=audit.cases.filter(x=>x.productId===target.productId);
    const observations=prior.outcomes.filter(x=>x.brand===target.brand);
    if(cases.length!==1||observations.length!==1||
      cases[0].brand!==target.brand||
      cases[0].catalogSizeMl!==target.sizeMl||
      !positiveNumber(target.sizeMl)||
      typeof target.name!=="string"||!target.name.trim()||
      !Array.isArray(cases[0].sources))
      invalid("CATALOG_OR_COHORT_MISMATCH");
    const entries=cases[0].sources;
    const providerIds=new Set(),urls=new Set();
    const atoms=entries.flatMap(entry=>{
      const claims=extractP2SecondaryClaimAtoms(entry);
      if(providerIds.has(entry.provider)||urls.has(entry.url)||
        !validUrl(target.officialPeerUrl)||
        new URL(target.officialPeerUrl).origin===new URL(entry.url).origin)
        invalid("SECONDARY_PROVENANCE_INVALID");
      providerIds.add(entry.provider);urls.add(entry.url);
      return claims;
    });
    const byProvider=entries.map(entry=>({
      provider:entry.provider,unitCount:entry.physicalContainerCount,
      perUnitMl:entry.unitVolumeMl,
    }));
    const singleUnitMl=byProvider.filter(x=>
      x.unitCount===1&&positiveNumber(x.perUnitMl));
    const matched=singleUnitMl.filter(x=>x.perUnitMl===target.sizeMl);
    const divergent=singleUnitMl.filter(x=>x.perUnitMl!==target.sizeMl);
    const marketedMultipacks=byProvider.filter(x=>x.unitCount>1);
    const unitReviewLane=divergent.length?"CATALOG_VS_SINGLE_UNIT_LISTING_DISAGREEMENT":
      matched.length>=2?"SECONDARY_CAPACITY_CORROBORATION_ONLY":
      matched.length?"SINGLE_SECONDARY_CAPACITY_LEAD":
      entries.length?"ONLY_NON_COMPARABLE_OR_MULTIPACK_LEADS":
      "NO_SECONDARY_CAPACITY_LEADS";
    // A generic title/name-size candidate still does not prove a selected
    // offer, the page's retained content, or an independent exact SKU.
    const observed=observations[0];
    const identityReviewLane=observed.state==="IDENTITY_CANDIDATE_REVIEW_REQUIRED"?
      "HISTORICAL_OFFICIAL_TITLE_CANDIDATE_UNREVIEWABLE":
      observed.state==="BODY_MENTION_REVIEW_REQUIRED"?
        "BODY_NAME_MENTION_NOT_PRODUCT_IDENTITY":
        "NO_REVIEWABLE_PRIMARY_IDENTITY";
    const sourceLinkLane=cases[0].catalogReadOnly?.sourceOfferStatus??
      "CATALOG_SOURCE_NOT_AUDITED";
    const issues=[
      ...(divergent.length?["CATALOG_CAPACITY_NOT_RECONCILED"]:[]),
      ...(marketedMultipacks.length?["MARKETED_MULTIPACK_SEPARATE_FROM_UNIT"]:[]),
      ...(sourceLinkLane.includes("BUNDLE")?["CATALOG_SOURCE_LINK_OFFER_MISMATCH"]:[]),
      ...(observed.pageSha256?["OFFICIAL_PAGE_DIGEST_WITHOUT_RETAINED_CONTENT"]:[]),
    ];
    rows.push(Object.freeze({
      productId:target.productId,brand:target.brand,
      catalogAssertion:Object.freeze({
        familyName:target.name,capacityValue:target.sizeMl,capacityUnit:"ml",
        truthStatus:"UNVERIFIED_CATALOG_ASSERTION",
      }),
      unitReviewLane,identityReviewLane,sourceLinkLane,
      quantityClaims:atoms,
      observedSingleUnitMl:Object.freeze([...new Set(
        singleUnitMl.map(x=>x.perUnitMl))].sort((a,b)=>a-b)),
      marketedMultipackCount:marketedMultipacks.length,
      recordedPadCounts:Object.freeze([...new Set(
        atoms.filter(x=>x.dimension==="PHYSICAL_CONTAINER_PAD_COUNT")
          .map(x=>x.value))].sort((a,b)=>a-b)),
      reviewIssues:Object.freeze(issues),
      supportedClaimDimensions:Object.freeze([...new Set(
        atoms.map(x=>x.dimension))].sort()),
      officialExactSkuVerified:false,formulaVerified:false,
      catalogCorrectionAuthorized:false,subjectCreationAuthorized:false,
      factConfirmationAuthorized:false,sourceBindingAuthorized:false,
    }));
  }
  if(audit.cases.some(x=>!rows.some(y=>y.productId===x.productId))||
    prior.outcomes.some(x=>!rows.some(y=>y.brand===x.brand)))
    invalid("UNKNOWN_FROZEN_INPUT");
  const counts=Object.freeze({
    realFrozenCases:rows.length,
    catalogVsSingleUnitReview:rows.filter(x=>x.unitReviewLane===
      "CATALOG_VS_SINGLE_UNIT_LISTING_DISAGREEMENT").length,
    capacityCorroborationLeads:rows.filter(x=>x.unitReviewLane===
      "SECONDARY_CAPACITY_CORROBORATION_ONLY").length,
    catalogSourceLinkOfferReviews:rows.filter(x=>
      x.reviewIssues.includes("CATALOG_SOURCE_LINK_OFFER_MISMATCH")).length,
    independentlyAdjudicatedOfficialExactSku:0,
    realWorldIdentityAccuracy:null,
    realWorldAutoProcessingRate:null,
    accuracyEvaluationEligibleLabeledCases:0,
  });
  return Object.freeze({
    contract:P2_EVIDENCE_FIRST_SHADOW,
    status:"READ_ONLY_SHADOW_NOT_PRODUCTION_AUTHORITY",
    counts,rows:Object.freeze(rows),
    officialSiteRequests:0,dbWrites:0,catalogWrites:0,subjectWrites:0,
    factWrites:0,sourceBindingWrites:0,aiApiCalls:0,
  });
}
