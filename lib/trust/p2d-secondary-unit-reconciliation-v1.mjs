/**
 * Pure, read-only interpretation of frozen third-party public listing leads.
 * Search-index listings are NOT first-party exact-SKU identity evidence.
 * A listed quantity is per physical container; NEVER normalize two 300ml
 * containers into a catalog entry for one 600ml container.
 */
export const TRUST_P2_SECONDARY_AUDIT="trust-p2d-secondary-listing-unit-audit-v1";
const PROVENANCE="PUBLIC_INDEX_SECONDARY_REVIEW_ONLY";
const URL_OK=u=>{try{
  const x=new URL(u);return x.protocol==="https:"&&
    !x.username&&!x.password&&!x.hash&&!!x.hostname;
}catch{return false;}};
const reject=m=>{throw Error("TRUST_P2_SECONDARY_UNIT_AUDIT_"+m);};
export function summarizeTrustP2SecondaryListingUnits(cohort,audit){
  if(cohort?.contract!=="trust-p2d-five-brand-live-cohort-v2"||
    !Array.isArray(cohort.targets)||cohort.targets.length!==5||
    audit?.contract!==TRUST_P2_SECONDARY_AUDIT||
    audit.scope!=="FROZEN_FIVE_TARGETS_SECONDARY_PUBLIC_INDEX_REVIEW_ONLY"||
    !Array.isArray(audit.cases)||audit.cases.length!==5||
    !audit.safety||Object.values(audit.safety).some(x=>x!==0))
    reject("INVALID_MANIFEST");
  const seen=new Set(),rows=[];
  for(const target of cohort.targets){
    const entries=audit.cases.filter(c=>c.productId===target.productId);
    if(entries.length!==1||seen.has(target.productId))
      reject("COHORT_OR_DUPLICATE");
    seen.add(target.productId);
    const c=entries[0];
    if(c.brand!==target.brand||c.catalogSizeMl!==target.sizeMl||
      !Array.isArray(c.sources)||c.sources.length>4)
      reject("CATALOG_SCOPE_DRIFT");
    const providers=new Set(),urls=new Set();
    const originalOfficialOrigin=new URL(target.officialPeerUrl).origin;
    for(const x of c.sources){
      if(typeof x.provider!=="string"||!/^[a-z0-9]{2,40}$/i.test(x.provider)||
        providers.has(x.provider)||typeof x.url!=="string"||!URL_OK(x.url)||
        new URL(x.url).origin===originalOfficialOrigin||urls.has(x.url)||
        x.listingEvidence!==PROVENANCE||
        !Number.isInteger(x.physicalContainerCount)||x.physicalContainerCount<1||
        x.physicalContainerCount>12||
        (x.unitVolumeMl!==null&&
          (!Number.isFinite(x.unitVolumeMl)||x.unitVolumeMl<=0))||
        (x.sheetCount!==null&&
          (!Number.isInteger(x.sheetCount)||x.sheetCount<1))||
        (x.unitVolumeMl===null&&x.sheetCount===null))
        reject("INVALID_SECONDARY_LISTING");
      providers.add(x.provider);urls.add(x.url);
    }
    const single=c.sources.filter(x=>x.physicalContainerCount===1&&
      x.unitVolumeMl!==null);
    const contrary=single.filter(x=>x.unitVolumeMl!==target.sizeMl);
    const aligned=single.filter(x=>x.unitVolumeMl===target.sizeMl);
    const multipacks=c.sources.filter(x=>x.physicalContainerCount>1);
    const plausibleSingle=aligned.length>=2&&contrary.length===0&&
      multipacks.length===0;
    const stage=contrary.length?
      "CATALOG_SINGLE_CONTAINER_VOLUME_CONFLICT_REVIEW":
      multipacks.length?
        "SINGLE_CONTAINER_VS_MULTIPACK_REVIEW":
        plausibleSingle?
          "SECONDARY_SINGLE_UNIT_CORROBORATION_REVIEW_ONLY":
          c.sources.length?"INSUFFICIENT_SECONDARY_SINGLE_UNIT_EVIDENCE":
          "NO_SECONDARY_LISTING_EVIDENCE";
    rows.push(Object.freeze({
      productId:target.productId,brand:target.brand,catalogSizeMl:target.sizeMl,
      stage,secondaryListingCount:c.sources.length,
      singleContainerMatchingListings:aligned.length,
      conflictingSingleContainerListings:contrary.length,
      multiContainerListings:multipacks.length,
      // Source URLs and observations are leads, never verified first-party IDs.
      independentlyVerifiedOfficialExactSku:false,
      catalogCorrectionAuthorized:false,subjectCreationAuthorized:false,
      factConfirmationAuthorized:false,
    }));
  }
  if(new Set(audit.cases.map(x=>x.productId)).size!==5||
    audit.cases.some(x=>!seen.has(x.productId)))
    reject("UNKNOWN_CASE");
  return Object.freeze({
    contract:TRUST_P2_SECONDARY_AUDIT,
    frozenDenominator:5,
    secondaryCorroborationReviewProducts:rows.filter(x=>
      x.stage==="SECONDARY_SINGLE_UNIT_CORROBORATION_REVIEW_ONLY").length,
    catalogSingleContainerConflictReviewProducts:rows.filter(x=>
      x.stage==="CATALOG_SINGLE_CONTAINER_VOLUME_CONFLICT_REVIEW").length,
    independentlyVerifiedOfficialExactSkuCount:0,
    evidenceSourceAuthority:"UNVERIFIED_SECONDARY_PUBLIC_INDEX",
    firstPartyFetches:0,robotsFetches:0,dbWrites:0,sourceBindingWrites:0,
    subjectWrites:0,factWrites:0,aiApiCalls:0,
    items:rows,
  });
}
