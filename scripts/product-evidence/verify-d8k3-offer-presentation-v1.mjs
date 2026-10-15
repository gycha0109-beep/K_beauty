#!/usr/bin/env node
// D8K-3 synthetic-only view-model plus component source contracts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOfferPresentation } from '../../lib/commerce/product-offer-presentation-v1.mjs';
const fixture={status:'options_observed',groups:[
  {comparisonGroup:'single',optionKind:'single',packComposition:{unitSize:80,quantity:1,sizeUnit:'ml',gifts:[]},sortBasis:'observed_option_price',offers:[
    {offerId:'a',sellerName:'Official',observedPrice:24500,totalPrice:24500,observedAt:'2026-10-15T00:00:00Z',ctaEnabled:true,ctaHref:'https://example.com'}]},
  {comparisonGroup:'kit',optionKind:'kit',packComposition:{unitSize:80,quantity:2,sizeUnit:'ml',gifts:[{skuId:'serum',quantity:1}]},sortBasis:'known_total_checkout',offers:[
    {offerId:'b',sellerName:'Hwahae',observedPrice:29900,totalPrice:32900,observedAt:'2026-10-15T00:00:00Z'}]}
]};
let cases=0;
const ko=buildOfferPresentation(fixture,'ko');cases++;
assert.equal(ko.status,'available');
assert.equal(ko.groups.length,2);
assert.match(ko.groups[0].description,/단품.*80ml × 1/);
assert.match(ko.groups[1].description,/기획세트.*증정 구성 포함/);
assert.equal(ko.groups[0].rows[0].formattedAmount,'24,500원');
assert.equal(ko.groups[0].rows[0].shippingUnknown,true);
assert.equal(ko.groups[1].rows[0].formattedAmount,'32,900원');
assert.equal(ko.groups[1].rows[0].shippingUnknown,false);
assert.equal(ko.groups[0].rows[0].href,null);
assert.equal(ko.groups[0].rows[0].ctaEnabled,false);
const en=buildOfferPresentation(fixture,'en');cases++;
assert.equal(en.groups.length,2);
assert.match(en.groups[1].description,/Gift set.*Includes gift/);
assert.match(en.groups[0].rows[0].shippingMessage,/Shipping unverified/);
for (const input of [null,{status:'hold',groups:[]},{status:'checking',groups:[]},{status:'options_observed',groups:[]}]) {
  const view=buildOfferPresentation(input,'ko');cases++;
  assert.equal(view.groups.length,0);
  assert.equal(view.directCtaEnabled,false);
}
const filtered=buildOfferPresentation({...fixture,groups:[{...fixture.groups[0],offers:[
 {...fixture.groups[0].offers[0],observedPrice:0},{...fixture.groups[0].offers[0],observedPrice:null},
 {...fixture.groups[0].offers[0],observedPrice:12000}
]}]},'ko');cases++;
assert.equal(filtered.groups[0].rows.length,1);
const file=readFileSync('components/commerce/ProductOfferComparison.jsx','utf8');
for(const required of ['aria-label','role="status"','grid-cols-1','sm:grid-cols-2','dark:','disabled aria-disabled="true"','buildOfferPresentation']) {
  assert(file.includes(required),required);cases++;
}
assert(!file.includes('href={row.href}'));
assert(!file.includes('fetch('));
console.log(JSON.stringify({status:'PASS',stage:'D8K3_SHARED_COMMERCE_MOCK_UI_SHADOW',
  scenarios:cases,syntheticOnly:true,activePagesModified:false,realSellerPrices:false,
  directCtaEnabled:false,apiFieldsChanged:false,productWrites:0,offerWrites:0,releaseAuthorized:false}));
