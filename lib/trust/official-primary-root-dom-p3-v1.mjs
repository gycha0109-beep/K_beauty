/**
 * TRUST P3 strict nested-HTML primary product root investigation, v1.
 *
 * This is a deliberately conservative structural parser, NOT a complete HTML5
 * tree builder. Browser-repaired/malformed/implicit-close markup is HOLD.
 * No classification, SKU, Fact, source binding or DB approval is possible.
 */
import {sha256Hex} from "./official-source-fetch.mjs";
import {normalizeSemanticTextV1} from "./official-source-semantic-adapter.mjs";
export const TRUST_P3_STRICT_ROOT_VERSION="trust-p3-strict-primary-root-v1";
const MAX_BYTES=2*1024*1024,MAX_TAG_LENGTH=2048,MAX_SCAN=512*1024;
const MAX_TAGS=20000,MAX_DEPTH=512,MAX_ATTR=64,MAX_TEXT=600;
const VOID=new Set(["area","base","br","col","embed","hr","img","input","link",
  "meta","param","source","track","wbr"]);
const RAW=new Set(["script","style","noscript","template","svg"]);
const RAW_TITLE=/(?:^|[\s_-])(?:goods[-_]?(?:name|tit)|product[-_]?(?:name|title)|prd[-_]?name|item[-_]?tit[-_]?detail)(?:$|[\s_-])/i;
const ROOT_MARK=/(?:^|[\s_-])(?:goods?[-_]?(?:detail|view|info)|(?:product|prd)[-_]?(?:detail|view|info|main|wrapper|container)|item[-_]?(?:detail|info))(?:$|[\s_-])/i;
const NEGATIVE=/(?:^|[\s_-])(?:related|recommend(?:ed|ation|ations)?|review|comment|navigation|menu|sidebar|footer|header|carousel|upsell|cross[-_]?sell|wishlist|recently[-_]?viewed|search|popup|modal)(?:$|[\s_-])/i;
const ATTR=/^([:\w-]+)/;
const P3_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const norm=v=>normalizeSemanticTextV1(String(v??"")).toLowerCase().replace(/[-_]+/g," ")
  .replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim();
function boundary(s,offset){
  let quote=null;
  for(let i=offset;i<Math.min(s.length,offset+MAX_SCAN);i++){
    const ch=s[i];
    if(quote){if(ch===quote)quote=null;continue;}
    if(ch==="'"||ch==='"'){quote=ch;continue;}
    if(ch===">")return {end:i,oversized:i-offset>=MAX_TAG_LENGTH};
  }
  return {end:-1};
}
// Diagnostic reason is a *fixed enum*, never a raw attribute, tag text or CSS selector.
// Parser acceptance stays unchanged; every failure remains AMBIGUOUS_ATTRIBUTES HOLD.
function attrMap(raw){
  const attrs=Object.create(null);
  let i=0,n=0;
  const hold=reason=>({attrs:null,reason,attributeOrdinal:Math.min(n+1,MAX_ATTR+1)});
  while(i<raw.length){
    while(i<raw.length&&/[\s/]/.test(raw[i]))i++;
    if(i>=raw.length)break;
    const name=ATTR.exec(raw.slice(i));
    if(!name)return hold("UNSUPPORTED_ATTRIBUTE_SYNTAX");
    const key=name[1].toLowerCase();i+=name[1].length;
    while(/\s/.test(raw[i]??"")&&i<raw.length)i++;
    let value="";
    if(raw[i]==="="){
      i++;while(/\s/.test(raw[i]??"")&&i<raw.length)i++;
      const quote=raw[i]==='"'||raw[i]==="'"?raw[i++]:null;
      if(quote){
        const end=raw.indexOf(quote,i);
        if(end<0)return hold("UNTERMINATED_ATTRIBUTE_QUOTE");
        value=raw.slice(i,end);i=end+1;
      }else{
        const st=i;while(i<raw.length&&!/[\s/>]/.test(raw[i]))i++;
        if(i===st)return hold("EMPTY_UNQUOTED_VALUE");
        value=raw.slice(st,i);
      }
    }
    if(++n>MAX_ATTR)return {attrs:null,reason:"ATTRIBUTE_COUNT_LIMIT",
      attributeOrdinal:MAX_ATTR+1};
    if(!Object.hasOwn(attrs,key))attrs[key]=value.slice(0,256);
    else return {attrs:null,reason:"DUPLICATE_ATTRIBUTE_NAME",
      attributeOrdinal:Math.min(n,MAX_ATTR+1)};
  }
  return {attrs,reason:null,attributeOrdinal:0};
}
function nameVariants(product){
  return [...new Set([product.name,product.name_en,product.normalized_name]
    .map(norm).filter(v=>v.length>=6))];
}
function titleMatch(value,variants){
  const n=norm(value);
  return variants.some(v=>n===v||n.startsWith(v+" ")&&n.length<=v.length+24);
}
function cleanResult(sourceDigest,fields){
  return Object.freeze({
    contract:TRUST_P3_STRICT_ROOT_VERSION,sourceDigest,...fields,
    exactSkuVerified:false,marketVerified:false,formulationVerified:false,
    primaryRootAuthority:false,sourceBindingAuthorized:false,
    subjectCreationAuthorized:false,factConfirmationAuthorized:false,
    recommendationWrites:0,dbWrites:0,aiApiCalls:0,
  });
}
function parse(s){
  const root={tag:"#document",attrs:Object.create(null),parent:null,children:[],own:"",depth:0,
    blocked:false,uncertain:false};
  const stack=[root],nodes=[root];let i=0,tags=0,uncertainTags=0,abort=null;
  let attributeFailure=null;
  function appendText(text){
    const target=stack[stack.length-1];
    if(target.own.length<MAX_TEXT)target.own+=text.slice(0,MAX_TEXT-target.own.length);
  }
  while(i<s.length){
    const lt=s.indexOf("<",i);
    if(lt<0){appendText(s.slice(i));break;}
    if(lt>i)appendText(s.slice(i,lt));
    if(s.startsWith("<!--",lt)){
      const close=s.indexOf("-->",lt+4);
      if(close<0){abort="UNTERMINATED_COMMENT";break;}
      i=close+3;continue;
    }
    if(s.startsWith("<!",lt)||s.startsWith("<?",lt)){
      const b=boundary(s,lt+1);
      if(b.end<0){abort="UNTERMINATED_DECLARATION";break;}
      i=b.end+1;continue;
    }
    const m=/^<\s*(\/?)\s*([a-z][a-z0-9:-]*)\b/i.exec(s.slice(lt,lt+100));
    if(!m){appendText("<");i=lt+1;continue;}
    if(tags++>=MAX_TAGS){abort="TAG_LIMIT";break;}
    const b=boundary(s,lt+1);
    if(b.end<0){abort="TAG_SCAN_LIMIT";break;}
    const tag=m[2].toLowerCase(),closing=!!m[1];
    if(closing){
      if(stack.length===1||stack[stack.length-1].tag!==tag){
        abort="UNBALANCED_HTML";break;
      }
      stack.pop();i=b.end+1;continue;
    }
    const raw=s.slice(lt+m[0].length,b.end);
    const selfClosed=/\/\s*$/.test(raw);
    const parsed=b.oversized?
      {attrs:Object.create(null),reason:null,attributeOrdinal:0}:attrMap(raw);
    if(!parsed.attrs){
      abort="AMBIGUOUS_ATTRIBUTES";
      const knownTag=["div","span","section","article","form","select","option",
        "input","meta","link","h1","h2","script","img"].includes(tag);
      attributeFailure={
        reason:parsed.reason,
        tagKind:knownTag?tag.toUpperCase():"OTHER",
        attributeOrdinal:parsed.attributeOrdinal,
      };
      break;
    }
    const attrs=parsed.attrs;
    if(b.oversized)uncertainTags++;
    const parent=stack[stack.length-1];
    const marker=(attrs.class??"")+" "+(attrs.id??"");
    const excluded=parent.blocked||["nav","header","footer","aside"].includes(tag)||NEGATIVE.test(marker);
    const node={tag,attrs,parent,children:[],own:"",depth:stack.length,blocked:excluded,
      uncertain:parent.uncertain||b.oversized};
    nodes.push(node);parent.children.push(node);
    if(nodes.length>MAX_TAGS){abort="NODE_LIMIT";break;}
    i=b.end+1;
    if(RAW.has(tag)){
      const lower=s.toLowerCase();
      const end=lower.indexOf("</"+tag,i);
      if(end<0){abort="UNTERMINATED_RAW_BLOCK";break;}
      const tail=boundary(s,end+2+tag.length);
      if(tail.end<0){abort="UNTERMINATED_RAW_BLOCK";break;}
      i=tail.end+1;
      continue;
    }
    if(!VOID.has(tag)&&!selfClosed){
      stack.push(node);
      if(stack.length>MAX_DEPTH){abort="DEPTH_LIMIT";break;}
    }
  }
  if(!abort&&stack.length!==1)abort="UNBALANCED_HTML";
  return {root,nodes,tags,uncertainTags,abort,attributeFailure};
}
function descendantsText(node){
  let out="",total=0;
  const todo=[node];
  while(todo.length&&total<MAX_TEXT){
    const n=todo.pop();
    if(n!==node&&(n.blocked||n.tag==="a"))continue;
    const slice=n.own.slice(0,MAX_TEXT-total);out+=" "+slice;total+=slice.length;
    for(let j=n.children.length-1;j>=0;j--)todo.push(n.children[j]);
  }
  return out;
}
const isRoot=n=>!n.blocked&&
  (ROOT_MARK.test((n.attrs.class??"")+" "+(n.attrs.id??""))||
  Object.keys(n.attrs).some(k=>/^(?:data-product|data-goods|data-item)(?:-id|-detail|-info|-form|-root)?$/.test(k)));
function within(root,node){for(let p=node;p;p=p.parent)if(p===root)return true;return false;}
function inAnchor(node){for(let p=node;p;p=p.parent)if(p.tag==="a")return true;return false;}
function isTitle(node){
  if(node.blocked||inAnchor(node))return false;
  if(node.tag==="h1")return true;
  return ["div","span","strong","h2"].includes(node.tag)&&
    (RAW_TITLE.test((node.attrs.class??"")+" "+(node.attrs.id??""))||
     node.attrs.itemprop==="name");
}
/**
 * Requires strictly nested, balanced HTML. It intentionally does not use
 * browser repairs, implicit close, cross-root form=, related cards, OG or
 * JSON-LD to authorize a root. Unknown => HOLD.
 */
export function inspectTrustP3StrictPrimaryRoot(bytes,product){
  const buf=Buffer.from(bytes??"");
  if(!buf.length||buf.length>MAX_BYTES||!P3_UUID.test(product?.id??""))
    throw Error("TRUST_P3_STRICT_ROOT_INVALID_INPUT");
  const sourceDigest=sha256Hex(buf);
  const names=nameVariants(product);
  if(!names.length)return cleanResult(sourceDigest,{status:"CATALOG_NAME_NOT_SUPPORTED",
    matchedRoots:0,matchedTitles:0,ownedFormCount:0,ownedOptionControlCount:0,parseComplete:false});
  const tree=parse(buf.toString("utf8"));
  if(tree.abort||tree.uncertainTags>0)return cleanResult(sourceDigest,{
    status:tree.abort??"OVERSIZED_TAG_STRUCTURE_UNCERTAIN",
    parseComplete:false,scannedTags:Math.min(tree.tags,MAX_TAGS),
    skippedAttributeTags:Math.min(tree.uncertainTags,129),
    ...(tree.attributeFailure?{attributeFailure:tree.attributeFailure}:{}),
    matchedRoots:0,matchedTitles:0,ownedFormCount:0,ownedOptionControlCount:0});
  const roots=tree.nodes.filter(isRoot);
  const mains=tree.nodes.filter(n=>n.tag==="main"&&!n.blocked);
  if(roots.length===0&&mains.length===1)roots.push(mains[0]);
  const primaryTitleNodes=tree.nodes.filter(isTitle);
  if(roots.length>128||primaryTitleNodes.length>128)
    return cleanResult(sourceDigest,{status:"AMBIGUOUS_OR_EXCESSIVE_PRODUCT_NODES",
      parseComplete:false,scannedTags:Math.min(tree.tags,MAX_TAGS),
      skippedAttributeTags:0,matchedRoots:0,matchedTitles:0,
      ownedFormCount:0,ownedOptionControlCount:0});
  const titles=primaryTitleNodes.filter(n=>titleMatch(descendantsText(n),names));
  const terminalTitles=titles.filter(t=>!titles.some(other=>other!==t&&within(t,other)));
  const qualifying=roots.filter(root=>terminalTitles.some(t=>within(root,t)));
  // Nested marked ancestors of the same title are not two different SKUs.
  const deepest=qualifying.filter(root=>!qualifying.some(r=>r!==root&&within(root,r)));
  const otherNamed=tree.nodes.filter(isTitle).filter(n=>!n.blocked&&!inAnchor(n)&&
    !terminalTitles.some(t=>t===n||within(t,n)));
  const selected=deepest.length===1?deepest[0]:null;
  const owned=selected?tree.nodes.filter(n=>!n.blocked&&within(selected,n)):[];
  const forms=owned.filter(n=>n.tag==="form");
  const options=owned.filter(n=>n.tag==="select"||
    n.tag==="input"&&n.attrs.type?.toLowerCase()==="radio");
  const withinForm=options.filter(n=>forms.some(f=>within(f,n)));
  const ownedTitleCount=selected?terminalTitles.filter(n=>within(selected,n)).length:0;
  const status=deepest.length>1?"PRIMARY_ROOT_AMBIGUOUS":
    !selected||ownedTitleCount!==1?"PRIMARY_ROOT_NOT_PROVEN":
    otherNamed.some(n=>!within(selected,n)&&!n.blocked&&
      roots.some(r=>r!==selected&&!within(r,selected)&&within(r,n)))?
      "COMPETING_PRODUCT_TITLE":
    !forms.length||!withinForm.length?"OWNER_FORM_UNPROVEN":
    "SCOPED_NAME_AND_FORM_CANDIDATE";
  return cleanResult(sourceDigest,{
    status,parseComplete:true,scannedTags:Math.min(tree.tags,MAX_TAGS),
    skippedAttributeTags:0,rootMarkers:Math.min(roots.length,99),
    matchedRoots:Math.min(deepest.length,99),
    matchedTitles:Math.min(terminalTitles.length,99),
    ownedFormCount:Math.min(forms.length,99),
    ownedOptionControlCount:Math.min(withinForm.length,99),
    explicitlySelectedSizeVerified:false,rootScopedNameCandidate:status==="SCOPED_NAME_AND_FORM_CANDIDATE",
  });
}
