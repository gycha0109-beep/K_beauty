#!/usr/bin/env node
import fs from "node:fs";
import {pathToFileURL} from "node:url";
import {summarizeTrustP2SecondaryListingUnits} from "../lib/trust/p2d-secondary-unit-reconciliation-v1.mjs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
export function reportTrustP2SecondaryListingUnits({
  cohort=read("evidence/trust/p2d-five-brand-cohort-v2.json"),
  audit=read("evidence/trust/p2d-secondary-listing-unit-audit-20261020.json"),
}={}){
  return summarizeTrustP2SecondaryListingUnits(cohort,audit);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  console.log(JSON.stringify(reportTrustP2SecondaryListingUnits(),null,2));
}
