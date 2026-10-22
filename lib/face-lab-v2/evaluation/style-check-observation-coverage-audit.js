import { FACE_LAB_OBSERVATION_DEFINITIONS } from "../../face-lab-observation-contract.js";

/**
 * SC-03: read-only, whole-face observation coverage + propagation guard.
 *
 * Compares normalized observation fields with Current Face Profile (which
 * feeds downstream Style Delta). The result contains names/statuses/counts
 * ONLY; never source values, photos or arbitrary vision evidence strings.
 *
 * "available" source != independently validated style usefulness.
 */
export const STYLE_CHECK_OBSERVATION_COVERAGE_VERSION =
  "face-lab-style-check-observation-coverage-sc03-v1";

export const PROFILE_KEY_FEATURE_SOURCES = Object.freeze({
  faceShape: "outline.faceShape",
  jawlineAngularity: "outline.jawlineAngularity",
  faceLengthBalance: "vertical.faceLengthBalance",
  eyeDirection: "eyes.eyeDirection",
  featureConcentration: "featureLayout.featureConcentration",
  straightCurveBalance: "visualLanguage.straightCurveBalance",
  contourDefinition: "visualLanguage.contourDefinition",
  featureContrast: "visualLanguage.featureContrast"
});

export const PROFILE_STRUCTURAL_SOURCES = Object.freeze({
  faceShape: "outline.faceShape",
  foreheadWidthVsCheek: "outline.foreheadWidthVsCheek",
  jawWidthVsCheek: "outline.jawWidthVsCheek",
  jawlineAngularity: "outline.jawlineAngularity",
  jawTaper: "outline.jawTaper",
  cheekboneProminence: "outline.cheekboneProminence",
  faceLengthBalance: "vertical.faceLengthBalance",
  foreheadHeight: "vertical.foreheadHeight",
  midfaceLength: "vertical.midfaceLength",
  lowerFaceLength: "vertical.lowerFaceLength",
  eyeDirection: "eyes.eyeDirection",
  eyeLength: "eyes.eyeLength",
  eyeOpenness: "eyes.eyeOpenness",
  featureScale: "featureLayout.featureScale",
  featureConcentration: "featureLayout.featureConcentration",
  focalFeatures: "featureLayout.focalFeatures"
});

// These are requests for future observation work, not fields that exist today.
// A target action about brows or lips is not proof of vision-measured anatomy.
export const UNSUPPORTED_STYLE_OBSERVATIONS = Object.freeze([
  "browShape", "browThickness", "lipContour", "lipFullness",
  "hairCondition", "skinToneCalibrated"
]);

const array=(v)=>Array.isArray(v)?v:[];
const validEvidence=(v)=>Array.isArray(v)&&v.length>0&&
  v.every(s=>typeof s==="string"&&s.trim().length>0);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const srcField=(analysis,path)=>{
  const [group,key]=path.split(".");
  return analysis?.observations?.[group]?.[key];
};
const meaningful=(v)=>Array.isArray(v)?v.length>0:v!==null&&v!==undefined;
const keyBySource=new Map(Object.entries(PROFILE_KEY_FEATURE_SOURCES).map(([k,p])=>[p,k]));
const structuralBySource=new Map(Object.entries(PROFILE_STRUCTURAL_SOURCES).map(([k,p])=>[p,k]));

export function auditFaceLabStyleCheckObservationCoverage({
  analysis, currentFaceProfile
}={}) {
  const issues=[];
  const problem=(code,fieldPath=null)=>issues.push(fieldPath?{code,fieldPath}:{code});
  const summary={
    definedFields:0,available:0,unavailable:0,insufficient:0,
    keyFeatureSources:0,keyFeaturesExposed:0,
    structuralSources:0,structuralAvailable:0,
    notUsedInCurrentProfile:0,colorAppearanceAvailable:0
  };
  const groups=[];
  const ledger=[];
  const upstreamUnavailable=analysis?.status==="unavailable";

  for(const [group,fields] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    const groupStats={group,defined:0,available:0,held:0,
      keyFeatureSources:0,structuralSources:0};
    for(const key of Object.keys(fields)){
      const path=group+"."+key;
      const field=srcField(analysis,path);
      const status=field?.status||"missing";
      const isAvailable=status==="available";
      const keyFeatureKey=keyBySource.get(path)||null;
      const structuralKey=structuralBySource.get(path)||null;
      summary.definedFields++;
      groupStats.defined++;
      if(isAvailable){summary.available++;groupStats.available++;}
      else {groupStats.held++;}
      if(status==="unavailable")summary.unavailable++;
      if(status==="insufficient_evidence")summary.insufficient++;
      if(status==="missing")problem("normalized_observation_field_missing",path);
      if(keyFeatureKey){summary.keyFeatureSources++;groupStats.keyFeatureSources++;}
      if(structuralKey){summary.structuralSources++;groupStats.structuralSources++;}
      if(!keyFeatureKey&&!structuralKey)summary.notUsedInCurrentProfile++;
      if(group==="colorAppearance"&&isAvailable)summary.colorAppearanceAvailable++;

      if(isAvailable){
        if(!meaningful(field?.value)||!validEvidence(field?.evidence)||
           field?.source!=="vision")
          problem("available_field_missing_source_or_evidence",path);
      } else if(field && meaningful(field.value)) {
        problem("held_field_exposes_value",path);
      }

      ledger.push({
        fieldPath:path,status,
        profileUse:keyFeatureKey?"key_feature":structuralKey?
          "structural_only":"not_consumed_by_current_profile",
        sourceEvidencePresent:validEvidence(field?.evidence),
        unavailableReason:isAvailable?null:(typeof field?.unavailableReason==="string"?
          field.unavailableReason:status==="missing"?"field_missing":"unknown")
      });
    }
    groups.push(groupStats);
  }
  const profile=currentFaceProfile;
  if(upstreamUnavailable){
    if(profile?.status!=="unavailable"||
       array(profile?.keyFeatures).length>0)
      problem("unavailable_source_exposes_profile");
  } else {
    if(!profile||typeof profile!=="object"||Array.isArray(profile)){
      problem("current_face_profile_missing");
    } else {
      const keyFeatures=array(profile.keyFeatures);
      const seen=new Set();
      for(const feature of keyFeatures) {
        const key=feature?.key;
        const path=PROFILE_KEY_FEATURE_SOURCES[key];
        if(!path){problem("unknown_profile_key_feature");continue;}
        if(seen.has(key))problem("duplicate_profile_key_feature",path);
        seen.add(key);
        const source=srcField(analysis,path);
        if(source?.status!=="available"){
          problem("profile_key_feature_from_held_observation",path);
          continue;
        }
        if(String(Array.isArray(source.value)?source.value.join(","):source.value)!==
           feature?.direction ||
           !same(array(feature.evidence),array(source.evidence)) ||
           feature?.confidence!==source.confidence)
          problem("profile_key_feature_mismatch",path);
        summary.keyFeaturesExposed++;
      }
      for(const [key,path] of Object.entries(PROFILE_KEY_FEATURE_SOURCES)){
        const source=srcField(analysis,path);
        if(source?.status==="available"&&!seen.has(key))
          problem("available_key_feature_not_propagated",path);
      }
      const structural=profile.structuralProfile;
      const structuralValues=structural?.values;
      if(!structuralValues||typeof structuralValues!=="object"){
        problem("structural_profile_values_missing");
      } else {
        for(const [key,path] of Object.entries(PROFILE_STRUCTURAL_SOURCES)){
          const source=srcField(analysis,path);
          const expected=source?.status==="available"?source.value:null;
          if(!same(structuralValues[key]??null,expected))
            problem("structural_value_mismatch",path);
          if(expected!==null)summary.structuralAvailable++;
        }
      }
      if(profile.presentationObservations!==null &&
         profile.presentationObservations!==undefined)
        problem("presentation_observation_authority_changed");
    }
  }

  // Unknown groups/fields must not acquire normalized observation authority
  // through a caller-provided object or an unchecked schema extension.
  for(const [group,fields] of Object.entries(analysis?.observations||{})){
    const defined=FACE_LAB_OBSERVATION_DEFINITIONS[group];
    if(!defined){problem("undeclared_observation_group");continue;}
    for(const key of Object.keys(fields||{})){
      if(!Object.hasOwn(defined,key))
        problem("undeclared_observation_field");
    }
  }

  const quality=analysis?.quality;
  if(quality?.status==="available"){
    if(quality.value?.colorSuitability==="unsuitable" &&
       summary.colorAppearanceAvailable>0)
      problem("unusable_photo_exposes_color_observations");
    if(quality.value?.structureSuitability==="unsuitable" &&
       summary.available>summary.colorAppearanceAvailable)
      problem("unusable_photo_exposes_structural_observations");
  }
  return {
    version:STYLE_CHECK_OBSERVATION_COVERAGE_VERSION,
    status:issues.length?"contract_violation":upstreamUnavailable?
      "held_upstream_unavailable":"verified_wiring_only",
    summary,groups,ledger,issues,
    unsupportedStyleObservations:[...UNSUPPORTED_STYLE_OBSERVATIONS],
    normalizedFieldValuesPersisted:false,
    rawEvidencePersisted:false,
    photoAccuracyValidated:false,
    styleQualityValidated:false,
    productionAuthorization:false
  };
}
