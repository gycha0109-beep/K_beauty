#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {inspectTrustP3StrictPrimaryRoot as inspect}
  from "../lib/trust/official-primary-root-dom-p3-v1.mjs";
import {inspectTrustP3OwnedSelectedSizeShadow as shadow}
  from "../lib/trust/official-selected-size-shadow-p3-v1.mjs";
const product={id:"dd326b18-ea56-45fb-8571-42186b6c9159",
  name:"DERMA UV365 Red Calming Tone-up Sunscreen",size_ml:40};
const root=body=>'<html><body><section class="product-detail"><h1>'+
  product.name+'</h1>'+body+'</section></body></html>';
const select=(options,attrs='name="size"')=>
  '<form><select '+attrs+'>'+options+'</select></form>';
const op=(size,attrs='')=>'<option value="'+size+'" '+attrs+'>'+size+'</option>';
const check=body=>{
  const r=inspect(Buffer.from(root(body)),product);
  assert.equal(r.status,"SCOPED_NAME_AND_FORM_CANDIDATE");
  assert.equal(r.parseComplete,true);
  assert.equal(r.primaryRootAuthority,false);
  assert.equal(r.exactSkuVerified,false);
  assert.equal(r.factConfirmationAuthorized,false);
  assert.equal(r.subjectCreationAuthorized,false);
  assert.equal(r.dbWrites,0);
  assert.equal(r.aiApiCalls,0);
  return r.selectedVariantShadow;
};
const verify=(label,body,status)=>{
  const s=check(body);
  assert.equal(s.status,status,label);
  assert.equal(s.exactSkuVerified,false,label);
  assert.equal(s.selectedSizeVerified,false,label);
  assert.equal(s.factConfirmationAuthorized,false,label);
  assert.equal(s.subjectCreationAuthorized,false,label);
  assert.equal(s.dbWrites,0,label);
  assert.equal(s.aiApiCalls,0,label);
  return s;
};
const matched=verify("40ml selected",select(op("25ml")+op("40ml","selected")),
  "SELECTED_SIZE_MATCH_SHADOW_ONLY");
assert.equal(matched.catalogSizeMatchShadow,true);
assert.equal(matched.sizeControlGroupCount,1);
assert.equal(matched.explicitSelectionCount,1);
verify("25ml selected",select(op("25ml","selected")+op("40ml")),
  "SELECTED_SIZE_MISMATCH_HOLD");
verify("first option default not selected",select(op("40ml")+op("25ml")),
  "NO_EXPLICIT_SELECTED_SIZE_HOLD");
verify("two explicit choices",select(op("40ml","selected")+op("25ml","selected")),
  "MULTIPLE_EXPLICIT_SELECTIONS_HOLD");
verify("selected disabled",select(op("40ml","selected disabled")),
  "SELECTED_CONTROL_DISABLED_HOLD");
verify("whole select disabled",select(op("40ml","selected"),'name="size" disabled'),
  "SELECTED_CONTROL_DISABLED_HOLD");
verify("selected hidden",select(op("40ml","selected hidden")),
  "SELECTED_CONTROL_DISABLED_HOLD");
verify("aria-hidden",select(op("40ml","selected aria-hidden='true'")),
  "SELECTED_CONTROL_DISABLED_HOLD");
verify("fieldset disabled",'<form><fieldset disabled><select name="size">'+
  op("40ml","selected")+'</select></fieldset></form>',
  "SELECTED_CONTROL_DISABLED_HOLD");
verify("not sized select",select(op("40ml","selected"),'name="theme"'),
  "NO_SCOPED_SIZE_CONTROL_HOLD");
verify("selected bundle x2",select(op("40ml × 2","selected")),
  "BUNDLE_OR_SET_HOLD");
verify("selected bundle one plus one",select(op("40ml 1+1","selected")),
  "BUNDLE_OR_SET_HOLD");
verify("selected g not ml",select(op("40g","selected")),
  "NON_ML_UNIT_HOLD");
verify("selected kg not ml",select(op("1kg","selected")),
  "NON_ML_UNIT_HOLD");
verify("selected 40ml and 25ml together",select(op("40ml + 25ml","selected")),
  "SELECTED_SIZE_NOT_UNIQUE_HOLD");
verify("size not named",select(op("Medium","selected")),
  "SELECTED_SIZE_NOT_UNIQUE_HOLD");
verify("value and label mismatch",'<form><select name="size">'+
  '<option value="40ml" selected>25ml</option></select></form>',
  "VALUE_LABEL_CONFLICT_HOLD");
verify("duplicated select groups",'<form><select name="size">'+op("40ml","selected")+
  '</select><select name="size">'+op("40ml","selected")+'</select></form>',
  "MULTIPLE_SIZE_GROUPS_HOLD");
verify("more than one form",'<form><select name="size">'+op("40ml","selected")+
  '</select></form><form><input type="text" name="coupon"></form>',
  "FORM_OWNERSHIP_AMBIGUOUS_HOLD");
verify("radio explicitly checked",'<form><input type="radio" name="size" value="25ml">'+
  '<input type="radio" name="size" value="40ml" checked></form>',
  "SELECTED_SIZE_MATCH_SHADOW_ONLY");
verify("radio selected 25",'<form><input type="radio" name="size" value="25ml" checked>'+
  '<input type="radio" name="size" value="40ml"></form>',
  "SELECTED_SIZE_MISMATCH_HOLD");
verify("radio not checked",'<form><input type="radio" name="size" value="40ml"></form>',
  "NO_EXPLICIT_SELECTED_SIZE_HOLD");
verify("radio disabled",'<form><input type="radio" name="size" value="40ml" checked disabled></form>',
  "SELECTED_CONTROL_DISABLED_HOLD");
verify("radio duplicated groups",'<form><input type="radio" name="size" value="40ml" checked>'+
  '<input type="radio" name="volume" value="40ml"></form>',
  "RADIO_GROUP_AMBIGUOUS_HOLD");
verify("selected control in recommendations ignored",'<form><div class="related-products">'+
  '<select name="size">'+op("40ml","selected")+'</select></div>'+
  '<select name="size">'+op("40ml")+'</select></form>',
  "NO_EXPLICIT_SELECTED_SIZE_HOLD");
verify("external group ignored",'<form><input name="code"><select name="size">'+
  op("40ml")+'</select></form>'+
  '<div class="related-products"><form><select name="size">'+
  op("40ml","selected")+'</select></form></div>',
  "NO_EXPLICIT_SELECTED_SIZE_HOLD");
const spoof=inspect(Buffer.from(root('<form><select name="size">'+op("40ml")+
  '</select></form><script><select name="size">'+op("40ml","selected")+
  '</select></script>')),product);
assert.equal(spoof.selectedVariantShadow.status,"NO_EXPLICIT_SELECTED_SIZE_HOLD");
const other=inspect(Buffer.from('<html><body><section class="product-detail">'+
  '<h1>UNRELATED NAME</h1>'+select(op("40ml","selected"))+
  '</section></body></html>'),product);
assert.equal(other.status,"PRIMARY_ROOT_NOT_PROVEN");
assert.equal(other.selectedVariantShadow,undefined);
const failRoot=inspect(Buffer.from(root(select(op("40ml","selected"))+
  '<div @click="privacy"></div>')),product);
assert.equal(failRoot.status,"AMBIGUOUS_ATTRIBUTES");
assert.equal(failRoot.selectedVariantShadow,undefined);
const bounded=shadow({owned:[],forms:[],within:()=>true,expectedMl:40});
assert.equal(bounded.status,"FORM_OWNERSHIP_AMBIGUOUS_HOLD");
const invalid=shadow({owned:[],forms:[],within:()=>true,expectedMl:Infinity});
assert.equal(invalid.status,"INVALID_OR_UNBOUNDED_INPUT_HOLD");
const encoded=JSON.stringify([matched,spoof,other,failRoot,invalid]);
for(const term of [product.name,"40ml","25ml","privacy","product-detail",
  "option value","related-products","name=\"size\""]){
  assert.ok(!encoded.includes(term),"sensitive/source payload leaked: "+term);
}
const source=fs.readFileSync("lib/trust/official-selected-size-shadow-p3-v1.mjs","utf8").toLowerCase();
for(const forbidden of [".insert(", ".upsert(", ".update(", ".delete(", ".rpc(",
  "supabase_service_role_key","openai","gemini"]){
 assert.ok(!source.includes(forbidden),"forbidden side effect "+forbidden);
}
console.log("TRUST_P3_OWNER_SELECTED_SIZE_SHADOW_HOLD_PASS");
