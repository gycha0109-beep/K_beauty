#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {inspectTrustP3StrictPrimaryRoot as inspect}
  from "../lib/trust/official-primary-root-dom-p3-v1.mjs";
const p={id:"dd326b18-ea56-45fb-8571-42186b6c9159",
 name:"더마 UV365 레드 카밍 톤업 선스크린",
 name_en:"DERMA UV365 Red Calming Tone-up Sunscreen",size_ml:40};
const title='<h1>'+p.name_en+'</h1>';
const form='<form id="product-form"><select name="size">'+
  '<option value="40ml" selected>40ml</option><option value="25ml">25ml</option>'+
  '</select></form>';
const wrap=s=>'<html><body>'+s+'</body></html>';
const product=s=>'<section class="product-detail">'+s+'</section>';
const go=s=>inspect(Buffer.from(s),p);
const success=go(wrap(product('<div class="product-name">'+title+'</div>'+form)));
assert.equal(success.status,"SCOPED_NAME_AND_FORM_CANDIDATE");
assert.equal(success.parseComplete,true);
assert.equal(success.rootScopedNameCandidate,true);
// The product-name wrapper and its nested h1 are two recognized markers;
// only the terminal matching title is counted toward root identity.
assert.equal(success.titleMarkerCount,2);
assert.equal(success.rootBodyNameMentionCount,1);
assert.equal(success.matchedRoots,1);
assert.equal(success.matchedTitles,1);
assert.equal(success.ownedFormCount,1);
assert.equal(success.ownedOptionControlCount,1);
assert.equal(success.exactSkuVerified,false);
assert.equal(success.explicitlySelectedSizeVerified,false);
assert.equal(success.primaryRootAuthority,false);
assert.equal(success.subjectCreationAuthorized,false);
assert.equal(success.factConfirmationAuthorized,false);
assert.equal(success.sourceBindingAuthorized,false);
assert.equal(success.dbWrites,0);
assert.equal(success.aiApiCalls,0);
// P2-F7 title vocabulary: only marked p/h3 containers are added. None of
// these page-level candidate signals can verify SKU or bypass selected size.
const markedTitleCases=[
  ["p with goods-name",'<p class="goods-name">'+p.name_en+'</p>'],
  ["h3 with item-name",'<h3 class="item-name">'+p.name_en+'</h3>'],
  ["p with goods-title",'<p class="goods-title">'+p.name_en+'</p>'],
  ["h3 with item-title",'<h3 class="item-title">'+p.name_en+'</h3>'],
];
for(const [name,markedTitle] of markedTitleCases){
  const result=go(wrap(product(markedTitle+form)));
  assert.equal(result.status,"SCOPED_NAME_AND_FORM_CANDIDATE",name);
  assert.equal(result.matchedTitles,1,name);
  assert.equal(result.titleMarkerCount,1,name);
  assert.equal(result.rootBodyNameMentionCount,1,name);
  assert.equal(result.selectedVariantShadow.status,
    "SELECTED_SIZE_MATCH_SHADOW_ONLY",name);
  assert.equal(result.exactSkuVerified,false,name);
  assert.equal(result.sourceBindingAuthorized,false,name);
}
const plainParagraph=go(wrap(product('<p class="detail-copy">'+p.name_en+'</p>'+form)));
assert.equal(plainParagraph.status,"PRIMARY_ROOT_NOT_PROVEN");
assert.equal(plainParagraph.titleMarkerCount,0);
assert.equal(plainParagraph.matchedTitles,0);
assert.equal(plainParagraph.rootBodyNameMentionCount,1);
const unrelatedParagraph=go(wrap(product('<p class="goods-name">Other item</p>'+form)));
assert.equal(unrelatedParagraph.status,"PRIMARY_ROOT_NOT_PROVEN");
assert.equal(unrelatedParagraph.titleMarkerCount,1);
assert.equal(unrelatedParagraph.matchedTitles,0);
assert.equal(unrelatedParagraph.rootBodyNameMentionCount,0);
const anchorTitle=go(wrap(product(
  '<a href="/unrelated"><p class="goods-name">'+p.name_en+'</p></a>'+form)));
assert.equal(anchorTitle.status,"PRIMARY_ROOT_NOT_PROVEN");
assert.equal(anchorTitle.matchedTitles,0);
assert.equal(anchorTitle.rootBodyNameMentionCount,0);
const relatedParagraph=go(wrap(product(
  '<div class="related-products"><h3 class="goods-name">'+p.name_en+
    '</h3></div>'+form)));
assert.equal(relatedParagraph.status,"PRIMARY_ROOT_NOT_PROVEN");
assert.equal(relatedParagraph.matchedTitles,0);
assert.equal(relatedParagraph.rootBodyNameMentionCount,0);
const outsideRoot=go(wrap(product(form)+
  '<h3 class="goods-name">'+p.name_en+'</h3>'));
assert.equal(outsideRoot.status,"PRIMARY_ROOT_NOT_PROVEN");
assert.equal(outsideRoot.matchedTitles,1);
assert.equal(outsideRoot.matchedRoots,0);
assert.equal(outsideRoot.rootBodyNameMentionCount,0);
const wrongSelected=go(wrap(product('<h3 class="goods-name">'+p.name_en+
  '</h3><form><select name="size"><option value="25ml" selected>25ml</option>'+
  '<option value="40ml">40ml</option></select></form>')));
assert.equal(wrongSelected.status,"SCOPED_NAME_AND_FORM_CANDIDATE");
assert.equal(wrongSelected.selectedVariantShadow.status,"SELECTED_SIZE_MISMATCH_HOLD");
assert.equal(wrongSelected.exactSkuVerified,false);

// P2-F8: the *observed* Torriden signal vector (6 roots, 1 title
// marker, 2 marked-root mentions, 0 matching titles) does NOT reveal the
// actual HTML cause. Distinct synthetic templates reproduce those counters.
// The new title fingerprint is diagnostic only, not a rescue/acceptance rule.
const torriden={
  id:"31015762-2741-4211-a553-3ceb7fdf32e8",
  name:"다이브인 저분자 히알루론산 세럼",
  name_en:"DIVE IN Low Molecular Hyaluronic Acid Serum",
  normalized_name:"다이브인 저분자 히알루론산 세럼",
  size_ml:50,
};
const inspectTorriden=body=>inspect(Buffer.from(
  '<html><head><title>토리든 Torriden</title></head><body>'+body+
  '</body></html>'),torriden);
const torridenRoot=body=>'<section class="product-detail">'+body+'</section>';
const fourEmptyRoots=Array.from({length:4},()=>torridenRoot(
  '<p>이벤트 및 배송 안내</p>')).join("");
const bodyMention='<p class="detail-copy">'+torriden.name+'</p>';
function fixtureWithTwoRootMentions(firstRoot,outerTitle=""){
  return inspectTorriden(outerTitle+torridenRoot(firstRoot)+
    torridenRoot(bodyMention)+fourEmptyRoots);
}
const mismatchFixtures=[
  {
    label:"marked title exists but is unrelated to the catalog name",
    observation:fixtureWithTwoRootMentions(
      '<h3 class="goods-name">TORRIDEN</h3>'+bodyMention),
    inside:1,outside:0,relation:"MARKED_TITLE_NO_CATALOG_NAME_RELATION",
    unmarkedHeading:0,unmarkedInline:2,
  },
  {
    label:"marked title is outside all recognized product roots",
    observation:fixtureWithTwoRootMentions(bodyMention,
      '<h1>TORRIDEN</h1>'),
    inside:0,outside:1,relation:"NO_MARKED_TITLE_IN_ROOT",
    unmarkedHeading:0,unmarkedInline:2,
  },
  {
    label:"marked title embeds full catalog name but is not an exact title",
    observation:fixtureWithTwoRootMentions(
      '<h3 class="goods-name">이번주 한정 행사 '+torriden.name+
      ' 증정품 및 할인 안내</h3>'),
    inside:1,outside:0,
    relation:"MARKED_TITLE_EMBEDS_CATALOG_NAME_BUT_FAILS_MATCH",
    unmarkedHeading:0,unmarkedInline:1,
  },
  {
    label:"marked title has only partial catalog tokens",
    observation:fixtureWithTwoRootMentions(
      '<h3 class="goods-name">다이브인 저분자</h3>'+bodyMention),
    inside:1,outside:0,
    relation:"MARKED_TITLE_PARTIAL_CATALOG_TOKEN_OVERLAP",
    unmarkedHeading:0,unmarkedInline:2,
  },
  {
    label:"full catalog name appears in an unmarked root-owned heading",
    observation:fixtureWithTwoRootMentions(
      '<div class="goods-name">TORRIDEN</div>'+
      '<h3 class="detail-copy">'+torriden.name+'</h3>'),
    inside:1,outside:0,
    relation:"MARKED_TITLE_NO_CATALOG_NAME_RELATION",
    unmarkedHeading:1,unmarkedInline:1,
  },
];
for(const v of mismatchFixtures){
  const result=v.observation,diag=result.titleMismatchFingerprint;
  // This exactly matches the status-only, non-HTML observation shape.
  assert.equal(result.status,"PRIMARY_ROOT_NOT_PROVEN",v.label);
  assert.equal(result.parseComplete,true,v.label);
  assert.equal(result.rootMarkers,6,v.label);
  assert.equal(result.titleMarkerCount,1,v.label);
  assert.equal(result.rootBodyNameMentionCount,2,v.label);
  assert.equal(result.matchedTitles,0,v.label);
  assert.equal(result.matchedRoots,0,v.label);
  assert.equal(diag.recognizedTitlesWithinRootCount,v.inside,v.label);
  assert.equal(diag.recognizedTitlesOutsideRootCount,v.outside,v.label);
  assert.equal(diag.catalogRelation,v.relation,v.label);
  assert.equal(diag.unmarkedNameProbeComplete,true,v.label);
  assert.equal(diag.unmarkedCatalogNameHeadingCount,v.unmarkedHeading,v.label);
  assert.equal(diag.unmarkedCatalogNameInlineCount,v.unmarkedInline,v.label);
  for(const flag of ["primaryRootAuthority","exactSkuVerified",
    "marketVerified","formulationVerified","sourceBindingAuthorized",
    "subjectCreationAuthorized","factConfirmationAuthorized"]){
    assert.equal(result[flag],false,v.label+" "+flag);
  }
  const serialized=JSON.stringify(result);
  for(const needle of ["TORRIDEN",torriden.name,
    "이번주","detail-copy","goods-name","<h3","<section","50ml"]){
    assert.ok(!serialized.includes(needle),"raw source leaked "+needle);
  }
}
// P2-F9: a full catalog name embedded INSIDE a longer marked title is
// review-only even when one deep root, one owned form, and an explicitly
// selected 50ml control agree. It must NOT change P3's strict identity status.
const embeddedNameTitle='<h3 class="goods-name">공식 스토어 | '+
  torriden.name+' | 안내</h3>';
const owned50='<form id="purchase-form"><select name="size">'+
  '<option value="50ml" selected>50ml</option>'+
  '<option value="100ml">100ml</option></select></form>';
const owned25=owned50.replace('value="50ml" selected',
  'value="50ml"').replace('value="100ml">','value="100ml">')
  .replace('value="100ml">100ml','value="25ml" selected>25ml');
const checkP2F9=(label,html,status,selectedSizeStatus=null)=>{
  const r=inspectTorriden(html);
  const shadow=r.embeddedTitleReviewShadow;
  assert.equal(r.parseComplete,true,label);
  assert.equal(r.primaryRootAuthority,false,label);
  assert.equal(r.exactSkuVerified,false,label);
  assert.equal(r.sourceBindingAuthorized,false,label);
  assert.equal(r.subjectCreationAuthorized,false,label);
  assert.equal(r.factConfirmationAuthorized,false,label);
  assert.equal(r.dbWrites,0,label);
  assert.equal(r.aiApiCalls,0,label);
  assert.ok(shadow,label+" must expose review-only shadow");
  assert.equal(shadow.status,status,label);
  assert.equal(shadow.reviewCandidate,
    status==="EMBEDDED_TITLE_OWNED_SELECTED_SIZE_REVIEW_ONLY",label);
  assert.equal(shadow.exactSkuVerified,false,label);
  assert.equal(shadow.selectedSizeStatus,selectedSizeStatus,label);
  const serialized=JSON.stringify(r);
  for(const secret of [torriden.name,
    "공식 스토어","공식몰 추천","goods-name","product-detail",
    "<h3","<form","<section","50ml","100ml","25ml"]){
    assert.ok(!serialized.includes(secret),
      label+" raw title, product, options or HTML leaked: "+secret);
  }
  return r;
};
const embeddedPositive=checkP2F9(
  "marked extended name with explicit owned 50ml",
  torridenRoot(embeddedNameTitle+owned50),
  "EMBEDDED_TITLE_OWNED_SELECTED_SIZE_REVIEW_ONLY",
  "SELECTED_SIZE_MATCH_SHADOW_ONLY");
assert.equal(embeddedPositive.status,"PRIMARY_ROOT_NOT_PROVEN");
assert.equal(embeddedPositive.matchedTitles,0);
assert.equal(embeddedPositive.matchedRoots,0);
assert.equal(embeddedPositive.ownedFormCount,0);
assert.equal(embeddedPositive.selectedVariantShadow,undefined);
assert.equal(embeddedPositive.rootScopedNameCandidate,false);
assert.equal(embeddedPositive.embeddedTitleReviewShadow.ownedFormCount,1);
assert.equal(embeddedPositive.embeddedTitleReviewShadow.ownedOptionControlCount,1);
const embeddedMultiRoot=checkP2F9(
  "one marked target within six unrelated marked roots",
  torridenRoot(embeddedNameTitle+owned50)+
    torridenRoot(bodyMention)+fourEmptyRoots,
  "EMBEDDED_TITLE_OWNED_SELECTED_SIZE_REVIEW_ONLY",
  "SELECTED_SIZE_MATCH_SHADOW_ONLY");
assert.equal(embeddedMultiRoot.rootMarkers,6);
assert.equal(embeddedMultiRoot.titleMarkerCount,1);
assert.equal(embeddedMultiRoot.matchedTitles,0);
assert.equal(embeddedMultiRoot.titleMismatchFingerprint.catalogRelation,
  "MARKED_TITLE_EMBEDS_CATALOG_NAME_BUT_FAILS_MATCH");
checkP2F9("no owned form",torridenRoot(embeddedNameTitle),
  "UNIQUE_OWNED_FORM_NOT_PROVEN_HOLD");
checkP2F9("unrelated sibling root owns purchase form",
  torridenRoot(embeddedNameTitle)+torridenRoot(owned50),
  "COMPETING_PURCHASABLE_ROOT_HOLD");
checkP2F9("separate nested product owns purchase form",
  torridenRoot(embeddedNameTitle+
    '<div class="item-detail">'+owned50+'</div>'),
  "CROSS_PRODUCT_FORM_HOLD");
checkP2F9("related card's form excluded",
  torridenRoot(embeddedNameTitle+
    '<div class="related-products">'+owned50+'</div>'),
  "UNIQUE_OWNED_FORM_NOT_PROVEN_HOLD");
checkP2F9("multiple purchase forms",
  torridenRoot(embeddedNameTitle+owned50+owned50),
  "UNIQUE_OWNED_FORM_NOT_PROVEN_HOLD");
checkP2F9("hidden otherwise owned purchase form",
  torridenRoot(embeddedNameTitle+owned50.replace(
    'id="purchase-form"','id="purchase-form" hidden')),
  "HIDDEN_OWNED_PURCHASE_FORM_HOLD");
checkP2F9("form with size selector is not a purchase form",
  torridenRoot(embeddedNameTitle+owned50.replace(
    'id="purchase-form"','id="profile-feedback"')),
  "PURCHASE_FORM_MARKER_MISSING_HOLD");
checkP2F9("another independent product root has its own purchase form",
  torridenRoot(embeddedNameTitle+owned50)+torridenRoot(
    '<div>다른 상품 구역</div>'+owned50),
  "COMPETING_PURCHASABLE_ROOT_HOLD");

checkP2F9("only button, no size control",
  torridenRoot(embeddedNameTitle+'<form id="purchase-form"><button>구매</button></form>'),
  "OWNED_OPTION_CONTROL_MISSING_HOLD");
checkP2F9("no explicit selected option",
  torridenRoot(embeddedNameTitle+owned50.replace(' selected','')),
  "SELECTED_CATALOG_SIZE_NOT_MATCHED_HOLD",
  "NO_EXPLICIT_SELECTED_SIZE_HOLD");
checkP2F9("wrong 25ml explicitly selected",
  torridenRoot(embeddedNameTitle+owned25),
  "SELECTED_CATALOG_SIZE_NOT_MATCHED_HOLD",
  "SELECTED_SIZE_MISMATCH_HOLD");
checkP2F9("selected 50ml disabled",
  torridenRoot(embeddedNameTitle+
    owned50.replace('value="50ml" selected','value="50ml" disabled selected')),
  "SELECTED_CATALOG_SIZE_NOT_MATCHED_HOLD",
  "SELECTED_CONTROL_DISABLED_HOLD");
checkP2F9("selected 50ml 1+1 bundle",
  torridenRoot(embeddedNameTitle+
    owned50.replace('value="50ml" selected>50ml',
      'value="50ml 1+1" selected>50ml 1+1')),
  "SELECTED_CATALOG_SIZE_NOT_MATCHED_HOLD",
  "BUNDLE_OR_SET_HOLD");
checkP2F9("sale or gift title",
  torridenRoot('<h3 class="goods-name">사은품 증정 | '+
    torriden.name+' | 안내</h3>'+owned50),
  "OFFER_OR_BUNDLE_TITLE_HOLD");
checkP2F9("hidden product title",
  torridenRoot('<h3 class="goods-name" hidden>'+
    '공식 스토어 | '+torriden.name+' | 안내</h3>'+owned50),
  "HIDDEN_MARKED_TITLE_HOLD");
checkP2F9("aria-hidden marked title",
  torridenRoot('<h3 class="goods-name" aria-hidden="true">'+
    '공식 스토어 | '+torriden.name+' | 안내</h3>'+owned50),
  "HIDDEN_MARKED_TITLE_HOLD");
checkP2F9("related/upsell title not primary",
  torridenRoot('<div class="related-products">'+embeddedNameTitle+
    '</div>'+owned50),
  "NO_MARKED_TITLE_HOLD");
checkP2F9("marked title outside recognized product root",
  embeddedNameTitle+torridenRoot(owned50),
  "TITLE_OUTSIDE_PRODUCT_ROOT_HOLD");
checkP2F9("two independent marked titles, one relevant",
  torridenRoot(embeddedNameTitle+'<h3 class="goods-name">Other Item</h3>'+owned50),
  "MULTIPLE_MARKED_TITLE_NODES_HOLD");
checkP2F9("other marked product root may compete",
  torridenRoot(embeddedNameTitle+owned50)+
    torridenRoot('<h3 class="goods-name">Different product</h3>'),
  "MULTIPLE_MARKED_TITLE_NODES_HOLD");
checkP2F9("incomplete catalog name only",
  torridenRoot('<h3 class="goods-name">공식몰 | 다이브인 저분자</h3>'+owned50),
  "NO_FULL_CATALOG_NAME_EMBED_HOLD");
checkP2F9("catalog name fused into a longer token",
  torridenRoot('<h3 class="goods-name">공식몰 | '+torriden.name+
    'ExtraSku</h3>'+owned50),
  "NO_FULL_CATALOG_NAME_EMBED_HOLD");
const alreadyStrict=checkP2F9("strict exact title untouched",
  torridenRoot('<h3 class="goods-name">'+torriden.name+'</h3>'+owned50),
  "STRICT_MATCH_TITLE_PRESENT_HOLD");
assert.equal(alreadyStrict.status,"SCOPED_NAME_AND_FORM_CANDIDATE");
assert.equal(alreadyStrict.selectedVariantShadow.status,
  "SELECTED_SIZE_MATCH_SHADOW_ONLY");
const hugeP2F9=checkP2F9("over 4096 HTML nodes: shadow stays HOLD",
  torridenRoot(embeddedNameTitle+owned50+'<span>표기</span>'.repeat(4098)),
  "REVIEW_SCAN_BUDGET_HOLD");
assert.equal(hugeP2F9.status,"PRIMARY_ROOT_NOT_PROVEN");
console.log("TRUST_P2F9_EMBEDDED_TITLE_SHADOW_HOLDS_PASS");

const diagSuccess=success.titleMismatchFingerprint;
assert.equal(diagSuccess.recognizedTitlesWithinRootCount,2);
assert.equal(diagSuccess.recognizedTitlesOutsideRootCount,0);
assert.equal(diagSuccess.catalogRelation,"MARKED_TITLE_CATALOG_NAME_MATCH");
assert.equal(diagSuccess.unmarkedCatalogNameHeadingCount,0);
assert.equal(diagSuccess.unmarkedCatalogNameInlineCount,0);

// Large but strictly balanced templates must not trigger unbounded probes or
// silently return zero counts that look like a completed name-location search.
const oversizedDiagnostic=inspectTorriden(torridenRoot(
  '<h3 class="goods-name">TORRIDEN</h3>'+
  '<span>안내</span>'.repeat(4100)+bodyMention));
assert.equal(oversizedDiagnostic.parseComplete,true);
assert.equal(oversizedDiagnostic.status,"PRIMARY_ROOT_NOT_PROVEN");
assert.equal(oversizedDiagnostic.titleMismatchFingerprint.unmarkedNameProbeComplete,false);
assert.equal(oversizedDiagnostic.titleMismatchFingerprint.unmarkedCatalogNameHeadingCount,null);
assert.equal(oversizedDiagnostic.titleMismatchFingerprint.unmarkedCatalogNameInlineCount,null);
assert.equal(oversizedDiagnostic.exactSkuVerified,false);
// Do not count linked, related, or hidden-looking nested headings as a
// primary root's unmarked catalog-name location.
const excludedName=inspectTorriden(torridenRoot(
  '<h3 class="goods-name">TORRIDEN</h3>'+
  '<div class="related-products"><h4>'+torriden.name+'</h4></div>'+
  '<a href="/recommend"><h3>'+torriden.name+'</h3></a>')+
  torridenRoot(bodyMention));
assert.equal(excludedName.status,"PRIMARY_ROOT_NOT_PROVEN");
assert.equal(excludedName.titleMismatchFingerprint.unmarkedCatalogNameHeadingCount,0);
assert.equal(excludedName.titleMismatchFingerprint.unmarkedCatalogNameInlineCount,1);
assert.equal(excludedName.exactSkuVerified,false);
console.log("TRUST_P2F8_TORRIDEN_DIAGNOSTIC_UNDERDETERMINATION_PASS");

const cases=[
 ["form owned by unrelated root",wrap(product(title)+product(form)),"OWNER_FORM_UNPROVEN"],
 ["related product form",wrap(product(title)+'<aside>'+form+'</aside>'),"OWNER_FORM_UNPROVEN"],
 ["recommendation form within parent",wrap(product(title+'<div class="related-products">'+form+'</div>')),"OWNER_FORM_UNPROVEN"],
 ["other independent matched root",wrap(product(title+form)+product(title+form)),"PRIMARY_ROOT_AMBIGUOUS"],
 ["OG title only",wrap('<meta property="og:title" content="'+p.name_en+'">'+product(form)),"PRIMARY_ROOT_NOT_PROVEN"],
 ["JSON-LD only",wrap('<script type="application/ld+json">{"name":"'+p.name_en+'","size":"40ml"}</script>'+product(form)),"PRIMARY_ROOT_NOT_PROVEN"],
 ["title in anchor",wrap(product('<a href="/cross-sell">'+title+'</a>'+form)),"PRIMARY_ROOT_NOT_PROVEN"],
 ["nested form outside inner title root",wrap(product('<div class="item-detail">'+title+'</div>'+form)),"OWNER_FORM_UNPROVEN"],
 ["option without form",wrap(product(title+'<select><option selected>40ml</option></select>')),"OWNER_FORM_UNPROVEN"],
 ["sibling title in unmarked area",wrap(product(form)+'<h1>'+p.name_en+'</h1>'),"PRIMARY_ROOT_NOT_PROVEN"],
 ["source different name",wrap(product('<h1>Other official product</h1>'+form)),"PRIMARY_ROOT_NOT_PROVEN"],
 ["disabled selected still not authorized",wrap(product(title+'<form><select name="size"><option disabled selected>40ml</option></select></form>')),"SCOPED_NAME_AND_FORM_CANDIDATE"],
 ["malformed nested",wrap(product(title+'<div>'+form+'</section>')),"UNBALANCED_HTML"],
 ["unclosed tag",wrap('<div>'+product(title+form)),"UNBALANCED_HTML"],
 ["cross-sell embedded title",wrap(product('<div class="related-products">'+title+'</div>'+form)),"PRIMARY_ROOT_NOT_PROVEN"],
 ["only 1 main with title and form",wrap('<main>'+title+form+'</main>'),"SCOPED_NAME_AND_FORM_CANDIDATE"],
 ["two mains unmarked",wrap('<main>'+title+form+'</main><main>'+title+form+'</main>'),"PRIMARY_ROOT_NOT_PROVEN"],
 ["script injection fake html",wrap('<script>'+product(title+form)+'</script>'+product(form)),"PRIMARY_ROOT_NOT_PROVEN"],
 ["quote HTML spoof",wrap(product('<div data-test="'+title.replaceAll('"',"&quot;")+'">'+form+'</div>')),"PRIMARY_ROOT_NOT_PROVEN"],
 ["selfclosing bracketed void",wrap(product(title+'<input name="x" value=">" />'+form)),"SCOPED_NAME_AND_FORM_CANDIDATE"],
];
for(const [name,html,status] of cases){
 const r=go(html);
 assert.equal(r.status,status,name);
 assert.equal(r.exactSkuVerified,false,name);
 assert.equal(r.factConfirmationAuthorized,false,name);
 assert.equal(r.subjectCreationAuthorized,false,name);
 assert.equal(r.dbWrites,0,name);
 assert.equal(r.aiApiCalls,0,name);
}
const nested=go(wrap(product('<div class="item-detail">'+title+form+'</div>')));
assert.equal(nested.status,"SCOPED_NAME_AND_FORM_CANDIDATE");
assert.equal(nested.matchedRoots,1);
const hugeAttr=go(wrap(product('<div data-blob="'+('PRIVATE_VALUE<>'.repeat(500))+'"></div>'+title+form)));
assert.equal(hugeAttr.status,"OVERSIZED_TAG_STRUCTURE_UNCERTAIN");
assert.equal(hugeAttr.parseComplete,false);
assert.equal(hugeAttr.rootScopedNameCandidate,undefined);
const large=go(wrap(product('<div data-blob="'+('x'.repeat(650000))+'"></div>'+title+form)));
assert.equal(large.status,"TAG_SCAN_LIMIT");
const badAttr=go(wrap(product('<div class="product-name" class="another">'+title+'</div>'+form)));
assert.equal(badAttr.status,"AMBIGUOUS_ATTRIBUTES");
assert.deepEqual(badAttr.attributeFailure,{
  reason:"DUPLICATE_ATTRIBUTE_NAME",tagKind:"DIV",attributeOrdinal:2});
const unsupported=go(wrap(product('<div @click="PRIVATE_TOKEN" class="product-name">'+
  title+'</div>'+form)));
assert.equal(unsupported.status,"AMBIGUOUS_ATTRIBUTES");
assert.deepEqual(unsupported.attributeFailure,{
  reason:"UNSUPPORTED_ATTRIBUTE_SYNTAX",tagKind:"DIV",attributeOrdinal:1});
const emptyValue=go(wrap(product('<section data-name= >'+title+'</section>'+form)));
assert.equal(emptyValue.status,"AMBIGUOUS_ATTRIBUTES");
assert.deepEqual(emptyValue.attributeFailure,{
  reason:"EMPTY_UNQUOTED_VALUE",tagKind:"SECTION",attributeOrdinal:1});
const tooManyAttrs=go(wrap(product('<article '+Array.from({length:65},
  (_,i)=>'data-a'+i+'="PRIVATE_SECRET"').join(' ')+'></article>'+title+form)));
assert.equal(tooManyAttrs.status,"AMBIGUOUS_ATTRIBUTES");
assert.deepEqual(tooManyAttrs.attributeFailure,{
  reason:"ATTRIBUTE_COUNT_LIMIT",tagKind:"ARTICLE",attributeOrdinal:65});
const unsupportedTag=go(wrap(product('<custom-view @click="PRIVATE_SECRET"></custom-view>'+
  title+form)));
assert.equal(unsupportedTag.status,"AMBIGUOUS_ATTRIBUTES");
assert.equal(unsupportedTag.attributeFailure.tagKind,"OTHER");
const leakProof=JSON.stringify([badAttr,unsupported,emptyValue,tooManyAttrs,unsupportedTag]);
for(const secret of ["PRIVATE_TOKEN","PRIVATE_SECRET","@click","data-a64",
  "another","data-name","product-name","<article","<section"]){
  assert.ok(!leakProof.includes(secret),"raw HTML/attributes must not leak: "+secret);
}
assert.ok([badAttr,unsupported,emptyValue,tooManyAttrs,unsupportedTag].every(x=>
  x.primaryRootAuthority===false&&x.exactSkuVerified===false&&
  x.factConfirmationAuthorized===false&&x.dbWrites===0&&x.aiApiCalls===0));

assert.throws(()=>go(""),/INVALID_INPUT/);
assert.throws(()=>inspect(Buffer.alloc(2*1024*1024+1),p),/INVALID_INPUT/);
assert.throws(()=>inspect(Buffer.from(wrap(product(title+form))),{...p,id:"invalid"}),/INVALID_INPUT/);
const many=go(wrap(product(title+form).repeat(130)));
assert.equal(many.status,"AMBIGUOUS_OR_EXCESSIVE_PRODUCT_NODES");
assert.equal(many.primaryRootAuthority,false);
const serialized=JSON.stringify(success);
for(const secret of [p.name_en,"product-detail","product-name","product-form","40ml","25ml"])
 assert.ok(!serialized.includes(secret),secret);
assert.deepEqual(success,go(wrap(product('<div class="product-name">'+title+'</div>'+form))));
const src=fs.readFileSync("lib/trust/official-primary-root-dom-p3-v1.mjs","utf8").toLowerCase();
for(const forbidden of [".insert(", ".upsert(", ".update(", ".delete(", ".rpc(",
  "supabase_service_role_key","openai","gemini"]){
  assert.ok(!src.includes(forbidden),"FORBIDDEN_SIDE_EFFECT "+forbidden);
}
console.log("TRUST_P3_STRICT_DOM_PRIMARY_ROOT_HOLD_POLICY_PASS");
