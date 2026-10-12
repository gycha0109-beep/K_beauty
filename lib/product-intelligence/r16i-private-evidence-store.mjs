import { createHash, randomUUID } from "node:crypto";
import { R16I_PRODUCT_ID } from "../product-offer-r16i-r4-d4-live-review.mjs";

export const R16I_EVIDENCE_BUCKET = "admin-product-correction-evidence";
export const R16I_EVIDENCE_TABLE = "admin_product_correction_evidence_v1";
export const R16I_EVIDENCE_MAX_BYTES = 4194304;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SELLERS = Object.freeze({
  official_single: "https://www.snature.kr/product/detail.html?product_no=151",
  hwahae_bundle: "https://www.hwahae.co.kr/goods/45194"
});
const FORM_FIELDS = Object.freeze([
  "sourceKey", "sourceUrl", "selectedOption", "checkoutPrice",
  "capturedAt", "notes", "image", "requestId"
]);
export function classifyR16IEvidenceImage(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 12) return null;
  if ([137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value))
    return { mimeType:"image/png", extension:"png" };
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255)
    return { mimeType:"image/jpeg", extension:"jpg" };
  if (Buffer.from(bytes.slice(0,4)).toString("ascii")==="RIFF" &&
      Buffer.from(bytes.slice(8,12)).toString("ascii")==="WEBP")
    return { mimeType:"image/webp", extension:"webp" };
  return null;
}
function bad(code) { throw new Error(code); }
function single(form,key){
  const values=form.getAll(key);
  return values.length===1 && typeof values[0]==="string" ? values[0] : null;
}
export function validateR16IEvidenceForm(form) {
  if (!form || typeof form.getAll!=="function" || typeof form.keys!=="function")
    bad("INVALID_FORM");
  const keys=[...form.keys()];
  if (keys.length!==FORM_FIELDS.length ||
      FORM_FIELDS.some(k=>!keys.includes(k)) ||
      keys.some(k=>!FORM_FIELDS.includes(k))) bad("INVALID_FIELDS");
  const sourceKey=single(form,"sourceKey");
  const sourceUrl=single(form,"sourceUrl");
  const selectedOption=single(form,"selectedOption")?.trim() ?? "";
  const checkoutPrice=single(form,"checkoutPrice")?.trim();
  const capturedAt=single(form,"capturedAt");
  const notes=single(form,"notes")?.trim() ?? "";
  const requestId=single(form,"requestId");
  const upload=form.getAll("image")[0];
  if (!Object.hasOwn(SELLERS,sourceKey) || sourceUrl !== SELLERS[sourceKey])
    bad("UNTRUSTED_SOURCE_IDENTITY");
  if (selectedOption.length > 500 || notes.length > 2000 || !UUID.test(requestId??""))
    bad("INVALID_TEXT_OR_REQUEST_ID");
  if (!capturedAt || !Number.isFinite(Date.parse(capturedAt)) ||
      Date.parse(capturedAt)>Date.now()+300000 ||
      Date.parse(capturedAt)<Date.now()-366*86400000)
    bad("INVALID_CAPTURE_TIME");
  if (checkoutPrice===null || (checkoutPrice!=="" && !/^(0|[1-9][0-9]{0,8})$/.test(checkoutPrice)))
    bad("INVALID_CLAIMED_PRICE");
  if (!upload || typeof upload.arrayBuffer!=="function" ||
      !Number.isSafeInteger(upload.size) || upload.size<12 || upload.size>R16I_EVIDENCE_MAX_BYTES)
    bad("INVALID_FILE_SIZE");
  if (!["image/png","image/jpeg","image/webp"].includes(upload.type))
    bad("INVALID_IMAGE_TYPE");
  return {
    sourceKey,sourceUrl,selectedOption,notes,
    checkoutPrice:checkoutPrice===""?null:Number(checkoutPrice),
    capturedAt:new Date(capturedAt).toISOString(),requestId,upload
  };
}

/** Evidence is unverified and immutable. No product values are modified. */
export async function saveR16IEvidence(client,userId,form) {
  if (!UUID.test(userId??"") || !client?.storage?.from || !client?.from)
    bad("EVIDENCE_STORE_UNAVAILABLE");
  const validated=validateR16IEvidenceForm(form);
  const bytes=new Uint8Array(await validated.upload.arrayBuffer());
  if(bytes.length!==validated.upload.size || bytes.length>R16I_EVIDENCE_MAX_BYTES)
    bad("FILE_SIZE_MISMATCH");
  const kind=classifyR16IEvidenceImage(bytes);
  if (!kind || kind.mimeType!==validated.upload.type)
    bad("IMAGE_MAGIC_MISMATCH");
  const fileHash=createHash("sha256").update(bytes).digest("hex");
  const objectPath=R16I_PRODUCT_ID+"/"+randomUUID()+"."+kind.extension;
  const bucket=client.storage.from(R16I_EVIDENCE_BUCKET);
  const uploadResult=await bucket.upload(objectPath, Buffer.from(bytes), {
    cacheControl:"0", contentType:kind.mimeType, upsert:false
  });
  if(uploadResult.error || !uploadResult.data) bad("PRIVATE_UPLOAD_FAILED");
  const record={
    product_id:R16I_PRODUCT_ID,
    source_key:validated.sourceKey,
    source_url:validated.sourceUrl,
    selected_option:validated.selectedOption,
    checkout_price_krw:validated.checkoutPrice,
    captured_at:validated.capturedAt,
    notes:validated.notes,
    object_path:objectPath,
    file_sha256:fileHash,
    mime_type:kind.mimeType,
    file_bytes:bytes.length,
    submitted_by:userId,
    client_request_id:validated.requestId,
    evidence_state:"UNVERIFIED"
  };
  const {data,error}=await client.from(R16I_EVIDENCE_TABLE)
    .insert(record).select("evidence_id,source_key,selected_option,checkout_price_krw,captured_at,evidence_state,created_at").single();
  if(error || !data){
    // Best effort orphan cleanup. A failed cleanup still MUST NOT mark the record saved.
    await bucket.remove([objectPath]).catch(()=>{});
    bad("EVIDENCE_RECORD_FAILED");
  }
  return Object.freeze({
    evidenceId:data.evidence_id,
    sourceKey:data.source_key,
    selectedOption:data.selected_option,
    claimedCheckoutPrice:data.checkout_price_krw,
    capturedAt:data.captured_at,
    createdAt:data.created_at,
    evidenceState:"UNVERIFIED",
    checkoutVerified:false,fieldApproved:false,productWrites:0
  });
}
export async function listR16IEvidence(client) {
  const {data,error}=await client.from(R16I_EVIDENCE_TABLE)
    .select("evidence_id,source_key,selected_option,checkout_price_krw,captured_at,created_at,evidence_state,file_sha256")
    .eq("product_id",R16I_PRODUCT_ID).order("created_at",{ascending:false}).limit(30);
  if(error || !Array.isArray(data)) bad("EVIDENCE_LIST_FAILED");
  return data.map(row=>({
    evidenceId:row.evidence_id,sourceKey:row.source_key,
    selectedOption:row.selected_option,claimedCheckoutPrice:row.checkout_price_krw,
    capturedAt:row.captured_at,createdAt:row.created_at,
    evidenceState:row.evidence_state,
    sha256:row.file_sha256,checkoutVerified:false,fieldApproved:false
  }));
}
export async function signR16IEvidence(client,evidenceId){
  if(!UUID.test(evidenceId??"")) bad("INVALID_EVIDENCE_ID");
  const {data,error}=await client.from(R16I_EVIDENCE_TABLE)
    .select("object_path").eq("product_id",R16I_PRODUCT_ID)
    .eq("evidence_id",evidenceId).maybeSingle();
  if(error || !data?.object_path) bad("EVIDENCE_NOT_FOUND");
  const signed=await client.storage.from(R16I_EVIDENCE_BUCKET)
    .createSignedUrl(data.object_path,60);
  if(signed.error || !signed.data?.signedUrl) bad("EVIDENCE_SIGN_FAILED");
  return {signedUrl:signed.data.signedUrl,expiresInSeconds:60};
}
