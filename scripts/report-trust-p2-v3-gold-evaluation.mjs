#!/usr/bin/env node
/** Offline evaluation readiness. Does not request sources, infer gold or write DB. */
import fs from "node:fs";
import {pathToFileURL} from "node:url";
import {evaluateP2V3GoldReadiness} from "../lib/trust/p2-v3-evaluation-gold-gate-v1.mjs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
export function reportP2V3GoldEvaluation({
  panel=read("evidence/trust/p2v3-real-catalog-evaluation-panel-20261021.json"),
  stress=read("evidence/trust/p2d-five-brand-cohort-v2.json"),
  ledger=read("evidence/trust/p2v3-independent-gold-ledger-v1.json"),
  predictions=[],
  readBytes=p=>fs.readFileSync(p),
}={}){
  return evaluateP2V3GoldReadiness(panel,stress,ledger,{predictions,readBytes});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(reportP2V3GoldEvaluation(),null,2));
