/**
 * Phase PR-A. Read-only *structural diagnostics* for first-party HTML.
 * No product matching, title extraction, selector values, authority or claims.
 * Output can be retained as bounded non-content metadata.
 */
import { sha256Hex } from "./official-source-fetch.mjs";

export const TRUST_P3_TEMPLATE_SHAPE_VERSION="trust-p3-template-shape-v1";
const MAX_BYTES=2*1024*1024;
const MAX_TAG_BYTES=2048;
// Bounded quote-aware skip, not extraction: long start tags yield partial counts.
const MAX_TAG_SCAN_BYTES=512*1024;
const MAX_OVERSIZED_TAGS=128;
const MAX_TAGS=20000;
const MAX_COUNT=99;
const SKIP_BLOCKS=new Set(["script","style","noscript","template","svg"]);
const VOID=new Set(["area","base","br","col","embed","hr","img","input","link",
  "meta","param","source","track","wbr"]);
const CATEGORIES={
  goodsDetail:/(?:^|[-_])goods?[-_]?(?:detail|view|info)(?:$|[-_])/i,
  productDetail:/(?:^|[-_])(?:product|prd)[-_]?(?:detail|view|info|main|wrapper|container)(?:$|[-_])/i,
  itemDetail:/(?:^|[-_])item[-_]?(?:detail|info)(?:$|[-_])/i,
  productDataAttribute:/\sdata-(?:product|goods|item)(?:-id|-detail|-info|-form|-root)?\s*(?:=|[>\s])/i,
};
const TITLE_CLASS=/(?:^|[\s_-])(?:goods[-_]?name|goods[-_]?tit|prd[-_]?name|product[-_]?name|product[-_]?title|item[-_]?tit[-_]?detail)(?:$|[\s_-])/i;
const OPTION_CLASS=/(?:^|[\s_-])(?:variant[-_]?picker|product[-_]?option|goods[-_]?option|option[-_]?selector|swatch[-_]?option|size[-_]?option)(?:$|[\s_-])/i;
const ATTRIBUTE=/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
const cap=n=>Math.min(n,MAX_COUNT);

function attributes(source){
  const obj=Object.create(null);
  ATTRIBUTE.lastIndex=0;
  for(const match of source.matchAll(ATTRIBUTE)){
    const key=match[1].toLowerCase();
    if(!Object.hasOwn(obj,key))obj[key]=(match[2]??match[3]??match[4]??"").slice(0,256);
  }
  return obj;
}
function hasBooleanAttr(open,name){
  return new RegExp("(?:^|\\s)"+name+"(?:\\s|=|/?>)","i").test(open);
}
function findEnd(html,start){
  // Skip over quoted '>' without copying untrusted attribute text into output.
  // An oversized tag is not interpreted as a trustworthy product-root marker.
  let quote=null;
  const bound=Math.min(html.length,start+MAX_TAG_SCAN_BYTES);
  for(let index=start;index<bound;index++){
    const char=html[index];
    if(quote){if(char===quote)quote=null;continue;}
    if(char==="'"||char==='"'){quote=char;continue;}
    if(char===">")return {end:index,oversized:index-start>=MAX_TAG_BYTES};
  }
  return {end:-1,scanLimitReached:bound<html.length};
}
function makeCounts(){
  return {
    mainCount:0,forms:0,productRootCandidates:0,h1Count:0,
    productRootMarkerCounts:{goodsDetail:0,productDetail:0,itemDetail:0,productDataAttribute:0},
    primaryTitleSurfaces:{h1WithinMain:0,h1WithinMarkedRoot:0,scopedNameClass:0,itempropName:0},
    variantControlSurfaces:{select:0,radio:0,option:0,optionWidget:0,
      explicitSelectedOption:0,explicitCheckedRadio:0,disabledSelected:0},
  };
}
/**
 * One bounded lexical scan; non-authoritative by contract.
 * Contents, class names, product IDs and option texts are never returned.
 */
export function inspectTrustP3TemplateShape(bytes,{contentType=""}={}){
  const buf=Buffer.from(bytes??"");
  if(!buf.length||buf.length>MAX_BYTES)throw Error("TRUST_P3_TEMPLATE_SHAPE_INVALID_BYTES");
  if(typeof contentType!=="string"||contentType.length>512)throw Error("TRUST_P3_TEMPLATE_SHAPE_BAD_CONTENT_TYPE");
  if(contentType&&!/text\/html|application\/xhtml\+xml/i.test(contentType))
    throw Error("TRUST_P3_TEMPLATE_SHAPE_NON_HTML");
  const html=buf.toString("utf8");
  const lower=html.toLowerCase();
  const counts=makeCounts();
  const stack=[];
  let cursor=0,scannedTags=0,scanStatus="COMPLETE",oversizedTagCount=0;
  while(cursor<html.length){
    const i=html.indexOf("<",cursor);
    if(i<0)break;
    if(html.startsWith("<!--",i)){
      const end=html.indexOf("-->",i+4);
      if(end<0){scanStatus="MALFORMED_COMMENT";break;}
      cursor=end+3;continue;
    }
    if(scannedTags>=MAX_TAGS){scanStatus="TAG_LIMIT_REACHED";break;}
    const boundary=findEnd(html,i+1);
    if(boundary.end<0){
      scanStatus=boundary.scanLimitReached?"TAG_SCAN_LIMIT_REACHED":"MALFORMED_OR_OVERSIZED_TAG";
      break;
    }
    const {end,oversized}=boundary;
    if(oversized){
      oversizedTagCount++;
      if(oversizedTagCount>MAX_OVERSIZED_TAGS){
        scanStatus="OVERSIZED_TAG_COUNT_LIMIT_REACHED";break;
      }
    }
    // Never examine unbounded attribute/class/option text for a long tag.
    const open=html.slice(i,Math.min(end+1,i+(oversized?256:MAX_TAG_BYTES+2)));
    cursor=end+1;
    if(/^<\s*[!?]/.test(open))continue;
    const m=/^<\s*(\/?)\s*([a-z][a-z0-9:-]*)\b/i.exec(open);
    if(!m)continue;
    const closing=!!m[1],tag=m[2].toLowerCase();
    scannedTags++;
    if(closing){
      const loc=stack.findLastIndex(x=>x.tag===tag);
      if(loc>=0)stack.length=loc;
      continue;
    }
    if(SKIP_BLOCKS.has(tag)){
      const close=lower.indexOf("</"+tag,cursor);
      if(close<0){scanStatus="MALFORMED_RAW_BLOCK";break;}
      const tail=findEnd(html,close+2+tag.length);
      if(tail.end<0){scanStatus="MALFORMED_RAW_BLOCK";break;}
      cursor=tail.end+1;
      continue;
    }
    // Skipped oversized tags count by type only; attributes and title/size
    // selectors stay unknown, even when a tempting prefix appears.
    const attrs=oversized?Object.create(null):attributes(open);
    const identity=[attrs.class,attrs.id].filter(Boolean).join(" ");
    const markers=Object.fromEntries(Object.entries(CATEGORIES).map(([key,re])=>
      [key,!oversized&&(key==="productDataAttribute"?re.test(open):re.test(identity))]));
    const marked=Object.values(markers).some(Boolean);
    const insideMain=stack.some(x=>x.tag==="main");
    const insideRoot=stack.some(x=>x.marked);
    if(tag==="main")counts.mainCount++;
    if(tag==="form")counts.forms++;
    if(marked){
      counts.productRootCandidates++;
      for(const key of Object.keys(markers))if(markers[key])counts.productRootMarkerCounts[key]++;
    }
    if(tag==="h1"){
      counts.h1Count++;
      if(insideMain)counts.primaryTitleSurfaces.h1WithinMain++;
      if(insideRoot)counts.primaryTitleSurfaces.h1WithinMarkedRoot++;
    }
    if(TITLE_CLASS.test(identity))counts.primaryTitleSurfaces.scopedNameClass++;
    if(attrs.itemprop==="name")counts.primaryTitleSurfaces.itempropName++;
    if(tag==="select")counts.variantControlSurfaces.select++;
    if(tag==="option"){
      counts.variantControlSurfaces.option++;
      if(!oversized&&hasBooleanAttr(open,"selected")){
        if(hasBooleanAttr(open,"disabled"))counts.variantControlSurfaces.disabledSelected++;
        else counts.variantControlSurfaces.explicitSelectedOption++;
      }
    }
    if(tag==="input"&&(attrs.type??"").toLowerCase()==="radio"){
      counts.variantControlSurfaces.radio++;
      if(!oversized&&hasBooleanAttr(open,"checked")){
        if(hasBooleanAttr(open,"disabled"))counts.variantControlSurfaces.disabledSelected++;
        else counts.variantControlSurfaces.explicitCheckedRadio++;
      }
    }
    if(!oversized&&OPTION_CLASS.test(identity))counts.variantControlSurfaces.optionWidget++;
    if(!VOID.has(tag)&&!open.endsWith("/>")){
      stack.push({tag,marked});
      if(stack.length>512){scanStatus="NESTING_LIMIT_REACHED";break;}
    }
  }
  if(scanStatus==="COMPLETE"&&oversizedTagCount>0)
    scanStatus="COMPLETE_WITH_SKIPPED_OVERSIZED_TAGS";
  const bounded={
    mainCount:cap(counts.mainCount),
    forms:cap(counts.forms),
    productRootCandidates:cap(counts.productRootCandidates),
    h1Count:cap(counts.h1Count),
    productRootMarkerCounts:Object.fromEntries(Object.entries(counts.productRootMarkerCounts).map(([key,val])=>[key,cap(val)])),
    primaryTitleSurfaces:Object.fromEntries(Object.entries(counts.primaryTitleSurfaces).map(([key,val])=>[key,cap(val)])),
    variantControlSurfaces:Object.fromEntries(Object.entries(counts.variantControlSurfaces).map(([key,val])=>[key,cap(val)])),
  };
  return Object.freeze({
    contract:TRUST_P3_TEMPLATE_SHAPE_VERSION,
    sourceDigest:sha256Hex(buf),
    htmlBytes:buf.length,scanStatus,scannedTags:Math.min(scannedTags,MAX_TAGS),
    oversizedTagCount:Math.min(oversizedTagCount,MAX_OVERSIZED_TAGS+1),
    // Partial counts are lower bounds, never negative evidence of absence.
    countsComplete:scanStatus==="COMPLETE",
    templateFamily:"UNDETERMINED",
    ...bounded,
    status:"DIAGNOSTICS_ONLY_NO_IDENTITY_OR_VARIANT_AUTHORITY",
    exactSkuVerified:false,marketVerified:false,formulationVerified:false,
    sourceBindingAuthorized:false,subjectCreationAuthorized:false,
    factConfirmationAuthorized:false,dbWrites:0,aiApiCalls:0,
  });
}
