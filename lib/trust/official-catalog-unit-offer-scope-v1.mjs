/**
 * Catalog-unit versus observed public-label units and offer composition.
 * No conversion between sheets/items, mass, and volume. No catalog mutations
 * or exact-SKU/Subject/Fact authority.
 */
export const TRUST_P2_UNIT_OFFER_VERSION="trust-p2-unit-offer-scope-v1";
const UNIT_RE=/(\d+(?:\.\d+)?)\s*(ml|mℓ|밀리리터|g|kg|그램|매|장|개|pcs|ea)(?![\p{L}\p{N}])/giu;
const FAMILY={ml:"ml","mℓ":"ml",밀리리터:"ml",
  g:"g",kg:"g",그램:"g",매:"sheet",장:"sheet",
  개:"item",pcs:"item",ea:"item"};
const LIMITED=8;
function unitsFromLabel(value){
  const found=[];
  for(const match of value.matchAll(UNIT_RE)){
    const unit=FAMILY[match[2].toLowerCase()];
    const number=Number(match[1]);
    if(unit&&Number.isFinite(number)&&number>0)found.push({value:number,unit});
    if(found.length>=LIMITED)break;
  }
  return found;
}
export function inspectTrustP2CatalogUnitOfferScope(label,product){
  const value=String(label??"").normalize("NFKC").slice(0,1000);
  const extracted=unitsFromLabel(value);
  const families=[...new Set(extracted.map(x=>x.unit))].sort();
  const rawCatalogSize=product?.size_ml;
  const catalogSize=rawCatalogSize===null||rawCatalogSize===undefined||rawCatalogSize===""?
    NaN:Number(rawCatalogSize);
  const known=Number.isFinite(catalogSize)&&catalogSize>0;
  const offerMarkers=/(?:\d+\s*(?:ml|g|매|장|개)\s*\+\s*\d+|\b1\s*\+\s*1\b|\b(?:bundle|set|gift|multipack|refill)\b|세트|기획|증정|사은품|본품\s*\+|\b\d+\s*(?:pack|pcs)\b|(?:x|×|\*)\s*[2-9]\d*)/iu.test(value);
  const mixedQuantities=extracted.length>1;
  // Repeated or ambiguous quantity tokens cannot establish a single SKU.
  const ambiguousQuantity=extracted.length!==1;
  const hasOfferConflict=offerMarkers||mixedQuantities;
  const incomparable=known&&families.some(x=>x!=="ml");
  const singleMl=extracted.length===1&&families.length===1&&
    families[0]==="ml"?extracted[0].value:null;
  const capacityMismatch=known&&singleMl!==null&&singleMl!==catalogSize;
  const unitRelation=!known?"CATALOG_QUANTITY_UNKNOWN":
    families.length===0?"SOURCE_UNIT_UNKNOWN":
    incomparable?"INCOMPARABLE_UNIT_FAMILY":
    capacityMismatch?"ML_CAPACITY_MISMATCH":
    singleMl===catalogSize?"ML_SIZE_MATCH_CANDIDATE":"ML_QUANTITY_AMBIGUOUS";
  const offerRelation=hasOfferConflict?"MULTI_COMPONENT_OR_PROMOTION_REVIEW":
    "SINGLE_OR_UNSPECIFIED";
  const status=incomparable&&hasOfferConflict?
    "UNIT_AND_OFFER_MISMATCH_REVIEW_REQUIRED":
    incomparable?"UNIT_MISMATCH_REVIEW_REQUIRED":
    hasOfferConflict?"OFFER_COMPOSITION_REVIEW_REQUIRED":
    capacityMismatch?"CATALOG_SIZE_MISMATCH":
    singleMl===catalogSize&&known&&!ambiguousQuantity?"SIZE_MATCH_CANDIDATE":
    "QUANTITY_SCOPE_REVIEW_REQUIRED";
  return Object.freeze({
    version:TRUST_P2_UNIT_OFFER_VERSION,status,
    catalogUnit:known?"ml":null,
    observedUnitFamilies:families,
    unitRelation,offerRelation,
    exactSkuVerified:false,
    catalogCorrectionAuthorized:false,
    factConfirmationAuthorized:false,
    subjectCreationAuthorized:false,
  });
}
