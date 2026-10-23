export const STYLE_CHECK_EXPLANATION_VERSION="face-lab-style-check-grounded-explanation-sc06h-v1";
const ACTION_COPY={
 "hair.outlineDefinition":{title:"헤어 윤곽부터 정리하세요",do:"가르마와 옆머리의 외곽선을 정리해 얼굴 주변의 흐름을 또렷하게 만드세요."},
 "hair.finishControl":{title:"잔머리와 끝선부터 정돈하세요",do:"전체를 눌러 붙이기보다 잔머리와 끝선을 가볍게 정리하세요."},
 "hair.silhouetteControl":{title:"옆으로 퍼지는 볼륨을 줄이세요",do:"옆머리는 차분히 누르고 윗부분의 볼륨만 필요한 만큼 남기세요."},
 "makeup.outerEyeEmphasis":{title:"눈꼬리 바깥쪽을 조금 더 또렷하게",do:"눈 전체를 진하게 칠하기보다 바깥쪽 3분의 1만 짧게 강조하세요."},
 "makeup.boundaryControl":{title:"강한 색보다 경계 정돈이 먼저입니다",do:"아이·립 메이크업은 한 부분만 선택해 윤곽을 깔끔하게 정리하세요."},
 "brow_grooming.shapeControl":{title:"눈썹의 흐트러진 끝선을 정리하세요",do:"눈썹을 새 모양으로 바꾸기보다 중간부터 꼬리까지 정돈하세요."},
 "accessories.visualNoise":{title:"얼굴 주변 포인트를 줄이세요",do:"안경이나 액세서리는 한 가지만 주인공으로 두고 나머지는 단순하게 맞추세요."},
 "eyewear.angularity":{title:"안경테 각도는 과하지 않게",do:"직선적인 프레임을 시도하되 모서리가 지나치게 날카로운 형태는 피하세요."},
 "color.temperatureDirection":{title:"얼굴 주변 색부터 맞춰보세요",do:"선택한 색 무드에 맞춰 상의나 액세서리 한 곳의 색만 먼저 조절하세요."},
 "makeup.selectedFeatureContrast":{title:"포인트는 한 군데만 잡으세요",do:"눈이나 입 중 한 곳을 선택해 대비를 높이고 다른 곳은 덜어내세요."}
};
const FACE_CUES={
 jawlineAngularity:{angular:"턱선에서 각이 비교적 선명하게 보입니다.",soft:"턱선이 부드러운 곡선에 가깝습니다.",moderate:"턱선은 부드러운 곡선과 각이 함께 보입니다."},
 eyeDirection:{upturned:"눈의 바깥쪽이 위로 올라가는 흐름입니다.",downturned:"눈의 바깥쪽이 아래로 흐르는 편입니다.",level:"눈의 양 끝 높이가 비교적 고르게 보입니다."},
 faceLengthBalance:{long:"얼굴의 세로 비율이 상대적으로 길게 보입니다.",short:"얼굴의 세로 비율이 상대적으로 짧게 보입니다.",balanced:"얼굴의 세로 비율이 한쪽으로 크게 치우치지 않습니다."},
 contourDefinition:{defined:"얼굴 윤곽의 경계가 비교적 또렷합니다.",soft:"얼굴 윤곽이 부드럽게 읽힙니다.",moderate:"얼굴 윤곽은 중간 정도로 드러납니다."},
 straightCurveBalance:{curved:"얼굴의 선에서 곡선 비중이 더 크게 느껴집니다.",straight:"얼굴의 선에서 직선적인 부분이 더 두드러집니다.",balanced:"직선과 곡선이 함께 보입니다."}
};
const TARGET={natural:"자연스러운 느낌",chic:"또렷하고 시크한 느낌",sophisticated:"세련되고 정돈된 느낌",clear_soft:"맑고 부드러운 느낌",soft:"부드러운 느낌",minimal:"담백한 느낌",classic:"단정한 느낌"};
const safe=x=>typeof x==="string"?x:"";
export function buildStyleCheckGroundedExplanation({canonical,targetKey,routeId,locale="ko"}={}){
 const routes=canonical?.routes;
 if(locale!=="ko"||canonical?.currentFaceProfile?.status!=="available"||routes?.status!=="available"||canonical?.targetStyle?.status!=="available")return {version:STYLE_CHECK_EXPLANATION_VERSION,status:"held",reason:"canonical_evidence_unavailable",cards:[],productionActive:false};
 const target=safe(targetKey)||canonical.targetStyle.targetLabels?.[0]||"";
 if(target && !canonical.targetStyle.targetLabels?.includes(target))return {version:STYLE_CHECK_EXPLANATION_VERSION,status:"held",reason:"target_mismatch",cards:[],productionActive:false};
 const route=(routes.routes||[]).find(r=>r.routeId===(routeId||routes.defaultRouteId));
 if(!route?.actions?.length)return {version:STYLE_CHECK_EXPLANATION_VERSION,status:"held",reason:"route_unavailable",cards:[],productionActive:false};
 const features=(canonical.currentFaceProfile.keyFeatures||[]).filter(f=>typeof f.direction==="string"&&Array.isArray(f.evidence)&&f.evidence.length&&Number.isFinite(f.confidence)&&f.confidence>0);
 const cue=features.map(f=>FACE_CUES[f.key]?.[f.direction]).find(Boolean)||null;
 const cards=route.actions.flatMap(a=>{
  const copy=ACTION_COPY[a.domain+"."+a.parameter]||null;if(!copy||!["light","moderate","strong"].includes(a.strength)||!["increase","decrease","shift","maintain"].includes(a.direction))return [];
  const evidence=(a.evidence||[]).filter(x=>typeof x==="string");
  const hasTargetEvidence=evidence.some(x=>x.startsWith("target_axis:"));
  const hasFaceEvidence=evidence.some(x=>x.startsWith("face_")||x.startsWith("observation:"));
  if(!hasTargetEvidence&&!hasFaceEvidence)return [];
  return [{title:copy.title,how:copy.do,strength:a.strength,source:{domain:a.domain,parameter:a.parameter,reason:a.reason,evidence},scope:hasFaceEvidence?"face_and_target":"target_only"}];
 }).slice(0,4);
 if(!cards.length)return {version:STYLE_CHECK_EXPLANATION_VERSION,status:"held",reason:"no_traceable_actions",cards:[],productionActive:false};
 const isFaceLinked=cards.some(c=>c.scope==="face_and_target");
 const goal=TARGET[target]||"선택한 스타일";
 return {version:STYLE_CHECK_EXPLANATION_VERSION,status:"research_copy_ready",headline:cards[0].title,
 summary:`${goal}을 원한다면 ${cards[0].how} 가장 먼저 바꿀 부분은 여기입니다.`,
 observedCue:cue,
 rationale:isFaceLinked&&cue?`${cue} 이 특징과 추구미를 함께 고려한 조정입니다.`:`이번 제안은 ${goal}이라는 목표와 선택한 스타일 경로를 기준으로 정했습니다.`,
 caveat:isFaceLinked?"사진에서 확인된 특징에 한정한 제안입니다.":"얼굴 특징과 직접 연결된 추천 근거는 충분하지 않아, 추구미 중심으로 제안합니다.",
 cards,qualityValidated:false,productionActive:false,providerInvoked:false};
}
