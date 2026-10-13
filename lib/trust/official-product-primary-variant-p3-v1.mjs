/**
 * Reusable, fail-closed product presentation and selected-size candidate probe.
 * Unselected variant choices, OG, script text and recommendation cards do not
 * establish an exact SKU. All results are review candidates, never authority.
 */
import {normalizeSemanticTextV1} from "./official-source-semantic-adapter.mjs";
export const TRUST_P3_PRIMARY_VARIANT_VERSION="trust-p3-primary-variant-candidate-v1";
const LIMIT=2*1024*1024;
const START_TAG_LIMIT=700;
const SUBTREE_LIMIT=1400;
const NAME_CLASS=/^(?:goods[_-]?(?:name|tit|title)|prd[_-]?(?:name|tit|title)|product[_-]?(?:name|tit|title)|product__title|item[_-]?tit[_-]?detail)$/i;
const SIZE_MARK=/(\d+(?:\.\d+)?)\s*(?:ml|mℓ|밀리리터)/giu;
const BUNDLE=/(?:\b[2-9]\d*\s*(?:pack|pcs|개|종|set)\b|\b(?:x|×|\*)\s*[2-9]\d*\b|\[\s*[2-9]\d*\s*종세트)/iu;
function normalize(v){return normalizeSemanticTextV1(v??"").toLowerCase()
  .replace(/[-_]+/g," ").replace(/[^\p{L}\p{N}]+/gu," ").trim();}
function attribute(open,name){
  const lower=open.toLowerCase();let i=0;
  while(i<lower.length){
    const idx=lower.indexOf(name.toLowerCase(),i);
    if(idx<0)return null;
    const before=lower[idx-1]??" ",after=lower[idx+name.length]??" ";
    if(!/[\s<]/.test(before)||!/[\s=>]/.test(after)){i=idx+name.length;continue;}
    let p=idx+name.length;
    while(open[p]===" "||open[p]==="\t"||open[p]==="\n")p++;
    if(open[p]!=="=")return "";
    p++;
    while(open[p]===" "||open[p]==="\t"||open[p]==="\n")p++;
    const quote=open[p]==='"'||open[p]==="'"?open[p++]:null;
    let end;
    if(quote){end=open.indexOf(quote,p);}
    else{end=p;while(end<open.length&&!/[\s>]/.test(open[end]))end++;}
    return end<0?null:open.slice(p,end).slice(0,200);
  }
  return null;
}
function hasBooleanAttribute(tag,name){
  const lower=tag.toLowerCase();let p=0;
  while((p=lower.indexOf(name,p))>=0){
    const before=lower[p-1]??" ",after=lower[p+name.length]??" ";
    if(/[\s]/.test(before)&&/[\s=>]/.test(after))return true;
    p+=name.length;
  }
  return false;
}
function scanTags(html,tag,{from=0,to=html.length,limit=1200}={}){
  const out=[],lower=html.toLowerCase();let p=from;
  while(out.length<limit&&p<to){
    const start=lower.indexOf("<"+tag,p);
    if(start<0||start>=to)break;
    const next=lower[start+tag.length+1]??" ";
    if(!/[\s/>]/.test(next)){p=start+tag.length+1;continue;}
    const end=lower.indexOf(">",start+tag.length+1);
    if(end<0||end>=to||end-start>START_TAG_LIMIT){p=start+tag.length+1;continue;}
    out.push({start,end,open:html.slice(start,end+1)});
    p=end+1;
  }
  return out;
}
function plain(html){return normalizeSemanticTextV1(html
  .replace(/<[^>]{0,900}>/g," ")
  .replace(/&nbsp;|&#160;/gi," "));}
function primaryHeading(html,nameVariants){
  const mains=scanTags(html,"main",{limit:10});
  const regions=[];
  if(mains.length===1){
    const main=mains[0],end=html.toLowerCase().indexOf("</main",main.end+1);
    if(end>=0)regions.push({start:main.end+1,end});
  }
  // Never infer primary identity from sidebars, product grids or body mentions.
  let matches=0;
  for(const region of regions){
    for(const tag of ["h1","h2","div","strong","span"]){
      for(const entry of scanTags(html,tag,{from:region.start,to:region.end,limit:400})){
        if(tag!=="h1"){
          const cls=attribute(entry.open,"class")??"";
          const itemprop=attribute(entry.open,"itemprop")??"";
          const id=attribute(entry.open,"id")??"";
          const tokens=(cls+" "+id).split(/[\s]+/);
          if(!tokens.some(t=>NAME_CLASS.test(t))&&itemprop.toLowerCase()!=="name")continue;
        }
        const close=html.toLowerCase().indexOf("</"+tag,entry.end+1);
        if(close<0||close>region.end||close-entry.end>SUBTREE_LIMIT)continue;
        const interior=html.slice(entry.end+1,close);
        if(/<a(?:\s|>)/iu.test(interior))continue;
        const n=normalize(plain(interior));
        if(nameVariants.some(v=>n===v||n.startsWith(v+" ")&&n.length<=v.length+24))matches++;
      }
    }
  }
  return {primaryTitleNameCandidate:matches===1,primaryTitleAmbiguous:matches>1,
    scopedNameOccurrences:Math.min(matches,4),hasMainContent:regions.length===1};
}
function sizeTokens(value){return [...String(value??"").matchAll(SIZE_MARK)]
  .map(m=>Number(m[1])).filter(x=>Number.isFinite(x)&&x>0);}
function unique(v){return [...new Set(v)];}
function selectedOptionSizes(html,expected){
  const mains=scanTags(html,"main",{limit:10});
  if(mains.length!==1)return {status:"NO_SCOPED_SELECTED_VARIANT",selectedSizesMl:[],optionSizesMl:[]};
  const start=mains[0].end+1,end=html.toLowerCase().indexOf("</main",start);
  if(end<0)return {status:"NO_SCOPED_SELECTED_VARIANT",selectedSizesMl:[],optionSizesMl:[]};
  const all=[],selected=[],lower=html.toLowerCase();
  for(const sel of scanTags(html,"select",{from:start,to:end,limit:120})){
    const key=[attribute(sel.open,"name"),attribute(sel.open,"id"),attribute(sel.open,"class"),
      attribute(sel.open,"data-option"),attribute(sel.open,"data-option-name")].filter(Boolean).join(" ");
    if(!/(?:size|용량|사이즈|variant|option)/iu.test(key))continue;
    const close=lower.indexOf("</select",sel.end+1);
    if(close<0||close>end||close-sel.end>30000)continue;
    for(const option of scanTags(html,"option",{from:sel.end+1,to:close,limit:150})){
      const finish=lower.indexOf("</option",option.end+1);
      if(finish<0||finish>close||finish-option.end>300)continue;
      const text=plain(html.slice(option.end+1,finish));
      const values=unique(sizeTokens(text+" "+(attribute(option.open,"value")??"")));
      if(values.length!==1)continue;
      all.push(values[0]);
      if(hasBooleanAttribute(option.open,"selected")&&!hasBooleanAttribute(option.open,"disabled"))
        selected.push(values[0]);
    }
  }
  // Radio candidates must be explicit sizes, checked and grouped by size name.
  for(const input of scanTags(html,"input",{from:start,to:end,limit:300})){
    if((attribute(input.open,"type")??"").toLowerCase()!=="radio")continue;
    const key=[attribute(input.open,"name"),attribute(input.open,"id"),
      attribute(input.open,"data-option-name")].filter(Boolean).join(" ");
    if(!/(?:size|용량|사이즈)/iu.test(key))continue;
    const values=unique(sizeTokens(attribute(input.open,"value")??""));
    if(values.length!==1)continue;
    all.push(values[0]);
    if(hasBooleanAttribute(input.open,"checked")&&!hasBooleanAttribute(input.open,"disabled"))
      selected.push(values[0]);
  }
  const chosen=unique(selected),options=unique(all);
  const status=selected.length!==1||chosen.length!==1?"NO_UNIQUE_SELECTED_SIZE":
    chosen[0]===expected?"SELECTED_SIZE_MATCH_CANDIDATE":"SELECTED_SIZE_MISMATCH";
  return {status,selectedSizesMl:chosen.slice(0,4),optionSizesMl:options.slice(0,5)};
}
/** Only independent scoped primary heading and explicitly selected UI option
 * can support a new P3 candidate gate; neither verifies SKU or formulation. */
export function inspectTrustP3PrimaryProductVariant(bytes,product){
  const buf=Buffer.from(bytes??"");
  if(!buf.length||buf.length>LIMIT||!product?.id)throw Error("TRUST_P3_PRIMARY_VARIANT_INVALID_INPUT");
  const html=buf.toString("utf8");
  const names=unique([product.name,product.name_en,product.normalized_name]
    .map(normalize).filter(x=>x.length>=6));
  const expected=Number(product.size_ml);
  const scope=primaryHeading(html,names);
  const selected=selectedOptionSizes(html,expected);
  const allSizes=selected.optionSizesMl;
  const bundleInPageTitle=(()=>{
    const t=scanTags(html,"title",{limit:1})[0];
    if(!t)return false;
    const end=html.toLowerCase().indexOf("</title",t.end+1);
    return end>=0&&end-t.end<300&&BUNDLE.test(plain(html.slice(t.end+1,end)));
  })();
  // Never admit a selected option from another product, no primary evidence.
  const variantCandidate=selected.status==="SELECTED_SIZE_MATCH_CANDIDATE"&&
    scope.primaryTitleNameCandidate&&!scope.primaryTitleAmbiguous&&
    !bundleInPageTitle&&Number.isFinite(expected)&&expected>0;
  return Object.freeze({contract:TRUST_P3_PRIMARY_VARIANT_VERSION,
    ...scope,...selected,bundleInPageTitle,
    variantCandidate,exactSkuVerified:false,marketVerified:false,
    formulationVerified:false,sourceBindingAuthorized:false,
    factConfirmationAuthorized:false});
}
