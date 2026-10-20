#!/usr/bin/env node
/**
 * Offline historical-cohort audit. Never contacts stores, DB, or AI services.
 * Human approvals are audited separately; this command cannot verify the
 * truth of a product-page or the contents of referenced reviewer documents.
 */
import fs from "node:fs";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
import {evaluateTrustP2DIndependentSkuReview} from "../lib/trust/p2d-independent-sku-review-v1.mjs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
/**
 * Independently check that reviewer references exist in the repository and
 * that committed metadata claims refer to the identical bytes. This only
 * establishes document provenance, not external-site accuracy or legal rights.
 */
export function validateTrustP2DReviewEvidenceFiles(ledger,readBytes=p=>fs.readFileSync(p)){
  for(const record of ledger.records??[]){
    for(const reviewer of record.reviewers??[]){
      const ref=reviewer.independentEvidenceRef;
      if(typeof ref!=="string"||
        !/^evidence\/trust\/[a-zA-Z0-9/_.-]+\.json$/.test(ref)||
        ref.includes(".."))
        throw Error("P2D_REVIEW_FILE_PATH_INVALID");
      let evidence,actual;
      try{
        const bytes=readBytes(ref);
        actual=createHash("sha256").update(bytes).digest("hex");
        evidence=JSON.parse(bytes.toString("utf8"));
      }catch{throw Error("P2D_REVIEW_EVIDENCE_NOT_READABLE");}
      if(actual!==reviewer.independentEvidenceSha256||
        evidence?.contract!=="trust-p2d-independent-sku-human-evidence-v1"||
        evidence.productId!==record.productId||
        evidence.intakeId!==record.intakeId||
        evidence.catalogName!==record.catalogName||
        evidence.catalogSizeMl!==record.catalogSizeMl||
        evidence.pageSha256!==record.pageSha256||
        evidence.pageUrl!==record.pageUrl||
        evidence.reviewerId!==reviewer.reviewerId||
        evidence.reviewedAtUtc!==reviewer.reviewedAtUtc||
        evidence.checks===undefined||
        ["primaryProductIdentity","singleSkuOffer","catalogQuantityAndUnit",
          "selectedPackageOwnership","notBundleOrGift"].some(
          k=>evidence.checks[k]!==true||record.checks[k]!==true))
        throw Error("P2D_REVIEW_DOCUMENT_PROVENANCE_MISMATCH");
    }
  }
}
export function reportTrustP2DIndependentSkuReview({
  cohort=read("evidence/trust/p2d-five-brand-cohort-v2.json"),
  observation=read("evidence/trust/p2f6-pre-resolved-readonly-observed-20261019.json"),
  index=read("evidence/trust/p2f6-ad-remeasurement-readiness-20261019.json"),
  ledger=read("evidence/trust/p2d-independent-sku-review-ledger-v1.json"),
}={}){
  const result=evaluateTrustP2DIndependentSkuReview(cohort,observation,index,ledger);
  validateTrustP2DReviewEvidenceFiles(ledger);
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  console.log(JSON.stringify(reportTrustP2DIndependentSkuReview(),null,2));
}
