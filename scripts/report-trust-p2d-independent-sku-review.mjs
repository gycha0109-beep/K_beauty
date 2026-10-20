#!/usr/bin/env node
/**
 * Offline historical-cohort audit. Never contacts stores, DB, or AI services.
 * Human approvals are audited separately; this command cannot verify the
 * truth of a product-page or the contents of referenced reviewer documents.
 */
import fs from "node:fs";
import {pathToFileURL} from "node:url";
import {evaluateTrustP2DIndependentSkuReview} from "../lib/trust/p2d-independent-sku-review-v1.mjs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
export function reportTrustP2DIndependentSkuReview({
  cohort=read("evidence/trust/p2d-five-brand-cohort-v2.json"),
  observation=read("evidence/trust/p2f6-pre-resolved-readonly-observed-20261019.json"),
  index=read("evidence/trust/p2f6-ad-remeasurement-readiness-20261019.json"),
  ledger=read("evidence/trust/p2d-independent-sku-review-ledger-v1.json"),
}={}){
  return evaluateTrustP2DIndependentSkuReview(cohort,observation,index,ledger);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  console.log(JSON.stringify(reportTrustP2DIndependentSkuReview(),null,2));
}
