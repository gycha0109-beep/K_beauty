#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  classifyR16IEvidenceImage,validateR16IEvidenceForm,saveR16IEvidence,
  listR16IEvidence,signR16IEvidence,R16I_EVIDENCE_BUCKET,R16I_EVIDENCE_TABLE
} from "../../lib/product-intelligence/r16i-private-evidence-store.mjs";

const PRODUCT="b639c8b4-6a61-440e-b4db-fac7381593ff";
const ACTOR="00000000-0000-4000-8000-0000000000f1";
const PNG=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0,1,1]);
const fakeFile=(bytes=PNG,type="image/png")=>({
  type,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)
});
const buildForm=(overrides={})=>{
  const all=new Map([
    ["sourceKey",["official_single"]],
    ["sourceUrl",["https://www.snature.kr/product/detail.html?product_no=151"]],
    ["selectedOption",["80ml 단품"]],
    ["checkoutPrice",[""]],
    ["capturedAt",[new Date().toISOString()]],
    ["notes",["관리자 입력 미검증"]],
    ["requestId",[randomUUID()]],
    ["image",[fakeFile()]]
  ]);
  for(const [key,value] of Object.entries(overrides)){
    if(value===undefined)all.delete(key);
    else all.set(key,Array.isArray(value)?value:[value]);
  }
  return {
    getAll:key=>all.get(key)||[],
    keys:function*(){for(const [key,items] of all) for(const _ of items)yield key;}
  };
};
assert.deepEqual(classifyR16IEvidenceImage(PNG),{mimeType:"image/png",extension:"png"});
assert.equal(classifyR16IEvidenceImage(Uint8Array.from([60,115,118,103,62,0,0,0,0,0,0,0])),null);
const clean=validateR16IEvidenceForm(buildForm());
assert.equal(clean.sourceKey,"official_single");
assert.equal(clean.checkoutPrice,null);
assert.equal(clean.upload.size,PNG.length);
assert.equal(clean.selectedOption,"80ml 단품");
let denied=0;
function rejects(label,overrides,reason){
  assert.throws(()=>validateR16IEvidenceForm(buildForm(overrides)),new RegExp(reason),label);
  denied++;
}
rejects("unknown source",{"sourceKey":"arbitrary"},"UNTRUSTED_SOURCE_IDENTITY");
rejects("source mismatch",{"sourceUrl":"https://example.com"},"UNTRUSTED_SOURCE_IDENTITY");
rejects("changed seller source",{"sourceKey":"hwahae_bundle"},"UNTRUSTED_SOURCE_IDENTITY");
rejects("approval injection",{"approval":"true"},"INVALID_FIELDS");
rejects("missing image",{"image":undefined},"INVALID_FIELDS");
rejects("duplicate file",{"image":[fakeFile(),fakeFile()]},"INVALID_FIELDS");
rejects("duplicated source",{"sourceKey":["official_single","official_single"]},"INVALID_FIELDS");
rejects("bad UUID",{"requestId":"id"},"INVALID_TEXT_OR_REQUEST_ID");
rejects("long note",{"notes":"x".repeat(2001)},"INVALID_TEXT_OR_REQUEST_ID");
rejects("price not digits",{"checkoutPrice":"29,900"},"INVALID_CLAIMED_PRICE");
rejects("price negative",{"checkoutPrice":"-1"},"INVALID_CLAIMED_PRICE");
rejects("price fractional",{"checkoutPrice":"1.5"},"INVALID_CLAIMED_PRICE");
rejects("future capture",{"capturedAt":"2099-01-01T00:00:00Z"},"INVALID_CAPTURE_TIME");
rejects("old capture",{"capturedAt":"2010-01-01T00:00:00Z"},"INVALID_CAPTURE_TIME");
rejects("oversized image",{"image":{size:4194305,type:"image/png",arrayBuffer:async()=>new ArrayBuffer(0)}},"INVALID_FILE_SIZE");
rejects("SVG forbidden",{"image":fakeFile(PNG,"image/svg+xml")},"INVALID_IMAGE_TYPE");
rejects("not actually a file",{"image":"abc"},"INVALID_FILE_SIZE");

const io={uploads:[],removals:[],inserts:[],queries:[]};
function client(options={}) {
  const storage={
    from(name){
      assert.equal(name,R16I_EVIDENCE_BUCKET);
      return {
        async upload(path,bytes,metadata){
          io.uploads.push({path,bytes,metadata});
          return {data:{path},error:null};
        },
        async remove(paths){io.removals.push(paths);return {data:paths,error:null};},
        async createSignedUrl(path,seconds){
          assert.equal(seconds,60);
          return {data:{signedUrl:"https://private.example/signed?token=one"},error:null};
        }
      };
    }
  };
  return {storage,from(table){
    assert.equal(table,R16I_EVIDENCE_TABLE);
    return {
      insert(record){
        io.inserts.push(record);
        return {select(){return {single:async()=>options.insertError?
          {data:null,error:{code:"write_failure"}}:
          {data:{evidence_id:randomUUID(),source_key:record.source_key,
            selected_option:record.selected_option,checkout_price_krw:record.checkout_price_krw,
            captured_at:record.captured_at,evidence_state:"UNVERIFIED",created_at:new Date().toISOString()},error:null}
        };};};
      },
      select(columns){
        io.queries.push(columns);
        const chain={
          eq(){return chain;},
          order(){return chain;},
          limit:async()=>({data:[],error:null}),
          maybeSingle:async()=>({data:{object_path:PRODUCT+"/"+randomUUID()+".png"},error:null})
        };
        return chain;
      }
    };
  }};
}
const saved=await saveR16IEvidence(client(),ACTOR,buildForm());
assert.equal(saved.evidenceState,"UNVERIFIED");
assert.equal(saved.fieldApproved,false);
assert.equal(saved.productWrites,0);
assert.equal(io.uploads.length,1);
assert.equal(io.inserts.length,1);
assert.equal(io.inserts[0].product_id,PRODUCT);
assert.equal(io.inserts[0].evidence_state,"UNVERIFIED");
assert.ok(io.inserts[0].object_path.startsWith(PRODUCT+"/"));
assert.equal(io.inserts[0].file_sha256.length,64);
assert.equal(io.inserts[0].checkout_price_krw,null);
assert.equal(io.uploads[0].metadata.upsert,false);
assert.equal(io.removals.length,0);
await assert.rejects(()=>saveR16IEvidence(client({insertError:true}),ACTOR,buildForm()),/EVIDENCE_RECORD_FAILED/);
assert.equal(io.removals.length,1);
await assert.rejects(()=>saveR16IEvidence(client(),"bad-user",buildForm()),/EVIDENCE_STORE_UNAVAILABLE/);
await assert.rejects(()=>saveR16IEvidence(client(),ACTOR,buildForm({image:fakeFile(PNG,"image/jpeg")})),/IMAGE_MAGIC_MISMATCH/);
const items=await listR16IEvidence(client());
assert.deepEqual(items,[]);
const signed=await signR16IEvidence(client(),randomUUID());
assert.equal(signed.expiresInSeconds,60);
await assert.rejects(()=>signR16IEvidence(client(),"bad"),/INVALID_EVIDENCE_ID/);

const sql=fs.readFileSync("supabase/migrations/20261012054000_taxonomy_ai_r16i_private_evidence_v1.sql","utf8");
const api=fs.readFileSync("app/api/admin/products/r16i-correction-review/evidence/route.js","utf8");
const store=fs.readFileSync("lib/product-intelligence/r16i-private-evidence-store.mjs","utf8");
const ui=fs.readFileSync("app/admin/products/r16i-correction-review/R16IR4D8PrivateEvidence.js","utf8");
const parent=fs.readFileSync("app/admin/products/r16i-correction-review/R16ICorrectionEvidenceWorkbench.js","utf8");
assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);
assert.match(sql,/REVOKE ALL ON TABLE public\.admin_product_correction_evidence_v1 FROM PUBLIC, anon, authenticated/i);
assert.match(sql,/VALUES\('admin-product-correction-evidence'/);
assert.match(sql,/false,4194304,ARRAY\['image\/png','image\/jpeg','image\/webp'\]/);
assert.match(sql,/evidence_state = 'UNVERIFIED'/);
assert.doesNotMatch(sql,/ALTER TABLE public\.products\b|UPDATE public\.products|INSERT INTO public\.product_offers/);
assert.match(api,/requireAdminCapability\(ADMIN_CAPABILITIES\.PRODUCTS_REVIEW\)/);
assert.match(api,/origin!==new URL\(request\.url\)\.origin/);
assert.match(api,/readR16IR4D4Review\(a\.client\)/);
assert.match(api,/review\.decision!=="REVIEW_REQUIRED"/);
assert.match(api,/request\.headers\.get\("content-length"\)/);
assert.match(api,/export async function GET\(request\)/);
assert.match(api,/export async function POST\(request\)/);
assert.doesNotMatch(api,/export async function (PUT|PATCH|DELETE)\(/);
assert.match(ui,/type="file"/);
assert.match(ui,/type="datetime-local"/);
assert.match(ui,/method:"POST"/);
assert.match(ui,/saved\.saved\?\.evidenceState!=="UNVERIFIED"/);
assert.match(ui,/개인정보는 올리기 전에 가려 주세요/);
assert.match(parent,/<R16IR4D8PrivateEvidence blocked=\{blocked\} \/>/);
assert.doesNotMatch(store,/\.from\(["']products["']\)\.(?:insert|update|delete)/);
console.log(JSON.stringify({status:"PASS",stage:"R16I-R4-D8B",
  invalid_inputs_blocked:denied,private_bucket:true,admin_only_api:true,
  file_magic_checked:true,upload_cleanup_on_error:true,preview_ttl_seconds:60,
  evidence_starts_unverified:true,product_writes:0}));
