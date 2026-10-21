#!/usr/bin/env node
import fs from "node:fs";
import {pathToFileURL} from "node:url";
import {reportP2EvidenceFirstShadow} from "../lib/trust/p2-evidence-first-shadow-v1.mjs";
const read=x=>JSON.parse(fs.readFileSync(x,"utf8"));
export function reportP2EvidenceFirstFrozen({
  cohort=read("evidence/trust/p2d-five-brand-cohort-v2.json"),
  audit=read("evidence/trust/p2d-secondary-listing-unit-audit-20261020.json"),
  observations=read("evidence/trust/p2f6-pre-resolved-readonly-observed-20261019.json"),
}={}){
  return reportP2EvidenceFirstShadow(cohort,audit,observations);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(reportP2EvidenceFirstFrozen(),null,2));
