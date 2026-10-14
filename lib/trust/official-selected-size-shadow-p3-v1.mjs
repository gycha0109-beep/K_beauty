/**
 * P3 PR-C: static, form-owned *shadow* selected-size probe.
 * Accepts only a strictly parsed, uniquely named primary root's descendants.
 * A matching selected 40ml surface is NOT an exact-SKU or Product Fact grant.
 * Never return option labels, product names, HTML, or SKU IDs.
 */
export const TRUST_P3_SELECTED_SIZE_SHADOW_VERSION="trust-p3-owned-selected-size-shadow-v1";
const SIZE_KEY=/(?:^|[^a-z])(?:size|sizes|volume|capacity|용량|사이즈)(?:$|[^a-z])/iu;
const SIZE_TOKEN=/(\d+(?:\.\d+)?)\s*(ml|mℓ|밀리리터|g|그램|kg|l|리터)/giu;
const BUNDLE=/(?:\b(?:[2-9]\d*\s*(?:pack|pcs|set)|bundle|gift\s*set|refill\s*set)\b|[2-9]\d*\s*(?:개|종|입|세트)|(?:x|×|\*)\s*[2-9]\d*|[2-9]\d*\s*(?:x|×|\*)|1\s*\+\s*1|본품\s*\+\s*증정)/iu;
const MAX_SURFACE=600,MAX_NODES=20000;
const count=n=>Math.min(n,99);
const result=(status,{groups=0,explicit=0,catalogMatch=false}={})=>Object.freeze({
  contract:TRUST_P3_SELECTED_SIZE_SHADOW_VERSION,status,
  sizeControlGroupCount:count(groups),explicitSelectionCount:count(explicit),
  catalogSizeMatchShadow:catalogMatch,
  selectedSizeVerified:false,exactSkuVerified:false,marketVerified:false,
  formulationVerified:false,sourceBindingAuthorized:false,
  subjectCreationAuthorized:false,factConfirmationAuthorized:false,
  recommendationWrites:0,dbWrites:0,aiApiCalls:0,
});
function selectedSize(surface){
  const s=String(surface??"").slice(0,MAX_SURFACE);
  if(BUNDLE.test(s))return {kind:"BUNDLE"};
  const list=[...s.matchAll(SIZE_TOKEN)].slice(0,3)
    .map(m=>({size:Number(m[1]),unit:m[2].toLowerCase()}));
  if(list.length===0)return {kind:"MISSING"};
  if(list.length!==1||!Number.isFinite(list[0].size)||list[0].size<=0)
    return {kind:"AMBIGUOUS"};
  if(!["ml","mℓ","밀리리터"].includes(list[0].unit))return {kind:"UNIT"};
  return {kind:"ML",size:list[0].size};
}
function parseSelectedSignal(node){
  const value=selectedSize(node.attrs.value);
  const text=selectedSize(node.own);
  if(value.kind==="BUNDLE"||text.kind==="BUNDLE")return {kind:"BUNDLE"};
  if(value.kind==="UNIT"||text.kind==="UNIT")return {kind:"UNIT"};
  if(value.kind==="AMBIGUOUS"||text.kind==="AMBIGUOUS")return {kind:"AMBIGUOUS"};
  if(value.kind==="MISSING"&&text.kind==="MISSING")return {kind:"MISSING"};
  if(value.kind==="ML"&&text.kind==="ML"&&value.size!==text.size)
    return {kind:"CONFLICT"};
  return value.kind==="ML"?value:text;
}
function isDisabled(node,form){
  for(let p=node;p&&p!==form;p=p.parent){
    if(Object.hasOwn(p.attrs,"disabled")||Object.hasOwn(p.attrs,"hidden")||
      p.attrs["aria-disabled"]==="true"||p.attrs["aria-hidden"]==="true"||
      /(?:^|;)\s*display\s*:\s*none\s*(?:;|$)/i.test(String(p.attrs.style??"")))
      return true;
  }
  return Object.hasOwn(form?.attrs??{},"disabled");
}
function isSizeControl(node){
  return SIZE_KEY.test([node.attrs.name,node.attrs.id,node.attrs["data-option-name"],
    node.attrs["data-option"],node.attrs["aria-label"]].filter(Boolean).join(" ").slice(0,1000));
}
/**
 * @param {object} args - transient strict-DOM nodes, never serialized.
 * @param {Array} args.owned - nodes within one verified-name primary container.
 * @param {Array} args.forms - purchase forms from that container.
 * @param {Function} args.within - strict parent-chain containment predicate.
 * @param {number} args.expectedMl - catalog size, NOT source-verified SKU.
 */
export function inspectTrustP3OwnedSelectedSizeShadow({owned,forms,within,expectedMl}={}){
  if(!Array.isArray(owned)||!Array.isArray(forms)||typeof within!=="function"||
    owned.length>MAX_NODES||forms.length>99||!Number.isFinite(expectedMl)||expectedMl<=0)
    return result("INVALID_OR_UNBOUNDED_INPUT_HOLD");
  if(forms.length!==1)return result("FORM_OWNERSHIP_AMBIGUOUS_HOLD");
  const form=forms[0];
  const controls=owned.filter(n=>!n.blocked&&within(form,n)&&
    ((n.tag==="select"&&isSizeControl(n))||
      (n.tag==="input"&&String(n.attrs.type??"").toLowerCase()==="radio"&&isSizeControl(n))));
  const selectControls=controls.filter(n=>n.tag==="select");
  const radios=controls.filter(n=>n.tag==="input");
  const groups=[];
  for(const select of selectControls){
    // Select options must be direct descendants of the same select, not a
    // related card, an optgroup clone or another form.
    const options=owned.filter(n=>n.tag==="option"&&!n.blocked&&
      n.parent?.tag==="select"&&n.parent===select);
    if(options.length>150)return result("CONTROL_OPTION_LIMIT_HOLD");
    groups.push({nodes:options,selected:options.filter(n=>Object.hasOwn(n.attrs,"selected")),
      disabled:Object.hasOwn(select.attrs,"disabled")||
        select.attrs["aria-disabled"]==="true"});
  }
  if(radios.length){
    const names=new Set(radios.map(n=>String(n.attrs.name??"").toLowerCase()));
    if(names.size!==1||names.has(""))return result("RADIO_GROUP_AMBIGUOUS_HOLD");
    groups.push({nodes:radios,selected:radios.filter(n=>Object.hasOwn(n.attrs,"checked")),
      disabled:false});
  }
  if(groups.length!==1)return result(groups.length?"MULTIPLE_SIZE_GROUPS_HOLD":"NO_SCOPED_SIZE_CONTROL_HOLD",
    {groups:groups.length});
  const group=groups[0],explicit=group.selected.length;
  if(explicit===0)return result("NO_EXPLICIT_SELECTED_SIZE_HOLD",{groups:1});
  if(explicit!==1)return result("MULTIPLE_EXPLICIT_SELECTIONS_HOLD",{groups:1,explicit});
  const chosen=group.selected[0];
  if(group.disabled||isDisabled(chosen,form))
    return result("SELECTED_CONTROL_DISABLED_HOLD",{groups:1,explicit});
  const size=parseSelectedSignal(chosen);
  if(size.kind==="BUNDLE")return result("BUNDLE_OR_SET_HOLD",{groups:1,explicit});
  if(size.kind==="UNIT")return result("NON_ML_UNIT_HOLD",{groups:1,explicit});
  if(size.kind==="CONFLICT")return result("VALUE_LABEL_CONFLICT_HOLD",{groups:1,explicit});
  if(size.kind!=="ML")return result("SELECTED_SIZE_NOT_UNIQUE_HOLD",{groups:1,explicit});
  if(size.size!==expectedMl)return result("SELECTED_SIZE_MISMATCH_HOLD",{groups:1,explicit});
  return result("SELECTED_SIZE_MATCH_SHADOW_ONLY",{groups:1,explicit,catalogMatch:true});
}
